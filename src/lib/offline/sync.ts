// Sends the offline queue to the server. Framework-free (no $app/*, no runes): the service worker imports it.
import { inverseOf } from './inverse';
import {
  bumpAttempts,
  listQueued,
  quarantine,
  removeQueued,
  splitQuarantine,
  strike,
  type QueuedInverse,
  type QueuedOp
} from './queue';
import type { OpResult, StockOp } from '$lib/stock-ops';

/** Same value as MAX_OPS_PER_REQUEST on the server (a $lib/server module cannot be bundled here). */
export const SYNC_BATCH_SIZE = 100;
/** A request hanging on a flaky network would hold the sync lock forever: give up and retry later. */
const REQUEST_TIMEOUT_MS = 15_000;
/** /healthz probe timeout (same as probeServer in online.svelte.ts). */
const PROBE_TIMEOUT_MS = 5_000;
/** Strikes after which a gesture is quarantined: no longer sent, no longer blocking the queue. */
export const MAX_STRIKES = 5;
/** Shared by the tabs and the service worker. */
const LOCK_NAME = 'apogee-sync';

export type SyncStatus = 'ok' | 'offline' | 'retry' | 'unauthorized' | 'idle' | 'busy';
/**
 * `undone`: opIds among `results` and `dropped` sent for an undo (undone gestures and their
 * inverses): no news for the user, who asked for it. `quarantined`: opIds quarantined by this sync.
 */
export type SyncOutcome = {
  sent: number;
  results: OpResult[];
  dropped: StockOp[];
  undone: string[];
  quarantined: string[];
  status: SyncStatus;
};
export type SyncListener = (userId: number, outcome: SyncOutcome) => void;

const listeners = new Set<SyncListener>();

/** Called after every sync that ran (not `busy`), before the lock is released. Returns an unsubscribe function. */
export function onSyncOutcome(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// In-tab lock: `active` counts the holder and the waiters, so a non-waiting caller sees it at once.
let active = 0;
let tail: Promise<void> = Promise.resolve();

/**
 * Runs `fn` holding this context's sync lock and, when the browser has it, the `apogee-sync`
 * Web Lock (one sync at a time across tabs and the service worker). Without `wait`, resolves
 * with null instead of waiting when either lock is taken.
 */
async function exclusive<T>(fn: () => Promise<T>, wait: boolean): Promise<T | null> {
  if (!wait && active > 0) return null;
  active++;
  const prev = tail;
  let release!: () => void;
  tail = new Promise<void>((r) => (release = r));
  try {
    await prev;
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (!locks) return await fn();
    return await locks.request(LOCK_NAME, wait ? {} : { ifAvailable: true }, (lock) => (lock ? fn() : null));
  } finally {
    active--;
    release();
  }
}

/** Runs `fn` once no sync is running (in this tab or elsewhere), keeping syncs out meanwhile. */
export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  return (await exclusive(fn, true)) as T;
}

/** Resolves once the syncs already running or waiting in this context are done. */
export function syncIdle(): Promise<void> {
  return tail;
}

const timeoutSignal = (ms: number = REQUEST_TIMEOUT_MS): AbortSignal | undefined =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;

export type PostOutcome =
  | { kind: 'ok'; results: OpResult[] }
  | { kind: 'invalid' } // 400: the server will never accept these ops
  | { kind: 'unauthorized' } // 401, or 409: the session belongs to another account than the ops
  // 5xx, network failure, timeout or unreadable body: maybe applied, replay later. `answered`: an
  // HTTP response arrived (unhandled status, or unreadable body), so the server itself is reachable.
  | { kind: 'failed'; answered: boolean };

/** Header naming the account the ops belong to; the server answers 409 when the session is another one. */
export const USER_HEADER = 'x-apogee-user';

/** Request headers for a POST of `userId`'s ops (no user header when unknown). */
export function opsHeaders(userId?: number): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (userId !== undefined) h[USER_HEADER] = String(userId);
  return h;
}

/**
 * One POST of `userId`'s `ops` to the stock endpoint. Ops are idempotent by opId: replaying one
 * returns its stored result. 401 and 409 (session of another account) are both `unauthorized`.
 */
export async function postOps(ops: StockOp[], userId: number, doFetch: typeof fetch = fetch): Promise<PostOutcome> {
  let answered = false;
  try {
    const res = await doFetch('/api/stock/ops', {
      method: 'POST',
      headers: opsHeaders(userId),
      body: JSON.stringify({ ops }),
      credentials: 'same-origin',
      signal: timeoutSignal()
    });
    answered = true;
    if (res.status === 401 || res.status === 409) return { kind: 'unauthorized' };
    if (res.status === 400) return { kind: 'invalid' };
    if (res.ok) {
      const body = (await res.json()) as { results?: unknown };
      if (Array.isArray(body.results)) return { kind: 'ok', results: body.results as OpResult[] };
    }
  } catch {
    // fall through
  }
  return { kind: 'failed', answered };
}

/**
 * Whether the server answers /healthz at all (any status). Standalone copy of probeServer
 * (online.svelte.ts is a runes module the service worker cannot import).
 */
export async function serverReachable(doFetch: typeof fetch = fetch): Promise<boolean> {
  try {
    await doFetch('/healthz', { cache: 'no-store', credentials: 'same-origin', signal: timeoutSignal(PROBE_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

/**
 * At most this many passes over the queue per sync: the inverses queued by one pass, and what
 * follows a gesture it quarantined, go in the next.
 */
const MAX_PASSES = 3;

async function run(userId: number, doFetch: typeof fetch): Promise<SyncOutcome> {
  const out: SyncOutcome = { sent: 0, results: [], dropped: [], undone: [], quarantined: [], status: 'ok' };
  let sendable = splitQuarantine(await listQueued(userId)).sendable;
  if (sendable.length === 0) return { ...out, status: 'idle' }; // quarantined rows wait for the user
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ...out, status: 'offline' };

  for (let pass = 0; pass < MAX_PASSES && sendable.length > 0; pass++) {
    const again = await sendQueued(sendable, userId, doFetch, out);
    if (out.status !== 'ok' || !again) break;
    // The inverses just queued, and what follows a gesture just quarantined, go in this same sync.
    sendable = splitQuarantine(await listQueued(userId)).sendable;
  }
  return out;
}

/** The batch starting at `rows[start]`: a struck gesture alone, else the following unstruck ones (at most SYNC_BATCH_SIZE). */
function nextBatch(rows: QueuedOp[], start: number): QueuedOp[] {
  if ((rows[start].strikes ?? 0) > 0) return [rows[start]];
  let end = start + 1;
  while (end < rows.length && end - start < SYNC_BATCH_SIZE && (rows[end].strikes ?? 0) === 0) end++;
  return rows.slice(start, end);
}

/**
 * One pass over `queued` (sendable rows only), in batches, filling `out`. Resolves true when
 * another pass is needed: it queued inverses, or quarantined a gesture (and stopped there).
 */
async function sendQueued(queued: QueuedOp[], userId: number, doFetch: typeof fetch, out: SyncOutcome): Promise<boolean> {
  let inversesQueued = 0;
  for (let i = 0; i < queued.length; ) {
    const rows = nextBatch(queued, i);
    i += rows.length;
    const ops = rows.map((q) => q.op);
    const ids = ops.map((o) => o.opId);
    const forUndo = rows.filter((q) => q.undo || q.inverseOf !== undefined).map((q) => q.op.opId);
    const res = await postOps(ops, userId, doFetch);
    if (res.kind === 'unauthorized') {
      out.status = 'unauthorized'; // nothing removed, no attempt counted: sent again once logged back in as this user
      break;
    }
    if (res.kind === 'invalid') {
      // Never accepted, so never applied: keep it from blocking the queue. Nothing to undo either.
      await removeQueued(ids);
      out.dropped.push(...ops);
      out.undone.push(...forUndo);
      continue;
    }
    if (res.kind === 'failed') {
      await bumpAttempts(ids); // attempts > 0: from now on the batch may have been applied
      // Blame the head of the batch only when the server is reachable (not a network outage).
      if (res.answered || (await serverReachable(doFetch))) {
        const head = ids[0];
        if ((await strike(head)) >= MAX_STRIKES) {
          await quarantine(head);
          out.quarantined.push(head);
          return true; // list again: the reviews it holds back and the gestures after it are recomputed
        }
      }
      out.status = 'retry';
      break;
    }
    // An undone gesture's result is known: its inverse is queued in the same transaction as its removal.
    const byId = new Map(res.results.map((r) => [r.opId, r]));
    const inverses: QueuedInverse[] = [];
    for (const q of rows) {
      const inv = q.undo ? inverseOf(q.op, byId.get(q.op.opId)) : null;
      if (inv) inverses.push({ userId, op: inv, inverseOf: q.op.opId });
    }
    await removeQueued(ids, inverses);
    inversesQueued += inverses.length;
    out.sent += ops.length;
    out.results.push(...res.results);
    out.undone.push(...forUndo);
  }
  return inversesQueued > 0;
}

/**
 * Sends the user's queued ops in arrival order, in batches of SYNC_BATCH_SIZE. 2xx removes them,
 * 400 drops them (`dropped`), 401 keeps everything (`unauthorized`), 5xx or a network failure keeps
 * the rest and counts an attempt (`retry`). A call made while another sync runs returns `busy`.
 *
 * Quarantine: quarantined gestures, and the reviews whose consume is one of them, are never sent
 * (nothing else to send → `idle`). A gesture with a strike goes alone; the others go in batches of
 * consecutive unstruck rows. A failed batch whose failure is imputable to the server (an HTTP
 * answer, or /healthz answering after a network error or timeout) strikes its head gesture. At
 * MAX_STRIKES the head is quarantined (listed in `quarantined`) and the queue is listed again, so
 * what follows is still sent in this sync (within MAX_PASSES); otherwise the sync stops on `retry`.
 * 400 and rejected ops never strike.
 */
export async function syncNow(userId: number, deps: { fetch?: typeof fetch } = {}): Promise<SyncOutcome> {
  const doFetch = deps.fetch ?? fetch; // a local: `deps.fetch(...)` would call window.fetch with the wrong `this`
  const out = await exclusive(async () => {
    const outcome = await run(userId, doFetch);
    for (const l of listeners) {
      try {
        l(userId, outcome);
      } catch {
        // A listener's failure must not fail the sync.
      }
    }
    return outcome;
  }, false);
  return out ?? { sent: 0, results: [], dropped: [], undone: [], quarantined: [], status: 'busy' };
}
