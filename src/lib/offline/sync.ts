// Sends the offline queue to the server. Framework-free (no $app/*, no runes): the service worker imports it.
import { inverseOf } from './inverse';
import {
  bumpAttempts,
  getLastSentAt,
  listQueued,
  quarantine,
  removeQueued,
  setLastSentAt,
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
  // 5xx, network failure, timeout or unreadable body: maybe applied, replay later. `answered`: the
  // app itself answered (unhandled status, or unreadable body). False for an exception and for
  // 502/503/504, which the reverse proxy sends while the app is down: those go through the probe.
  | { kind: 'failed'; answered: boolean };

/** Statuses a gateway (the reverse proxy) answers in the app's place: they say nothing about the app. */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

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
    answered = !GATEWAY_STATUSES.has(res.status);
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
 * Whether the app answers /healthz with a 2xx: a proxy's 502/503/504, or the app's own 503 (database
 * down), means it cannot be blamed for a failure. Same request as probeServer (online.svelte.ts is a
 * runes module the service worker cannot import), which counts any answer as online.
 */
export async function serverReachable(doFetch: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await doFetch('/healthz', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: timeoutSignal(PROBE_TIMEOUT_MS)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Circuit breaker: /healthz only checks that the database reads, so a server failing every write
 * would otherwise quarantine the whole queue, one gesture after the other. A new quarantine is only
 * allowed when a batch was accepted since the latest one: open (no quarantine) when another row of
 * the queue is quarantined and nothing was sent since (`lastSentAt` absent or not after it).
 */
async function breakerOpen(userId: number, opId: string): Promise<boolean> {
  let latest: number | undefined;
  for (const q of await listQueued(userId)) {
    if (q.op.opId !== opId && q.quarantinedAt !== undefined && (latest === undefined || q.quarantinedAt > latest)) {
      latest = q.quarantinedAt;
    }
  }
  if (latest === undefined) return false;
  const sentAt = await getLastSentAt();
  return sentAt === null || sentAt <= latest;
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

/** opIds of `rows` sent for an undo (undone gestures and their inverses). */
const undoIds = (rows: QueuedOp[]) => rows.filter((q) => q.undo || q.inverseOf !== undefined).map((q) => q.op.opId);

/**
 * Records a batch the server accepted (2xx): removes its rows, queuing in the same transaction the
 * inverse of each undone gesture whose result is now known, and closes the circuit breaker.
 * Resolves the number of inverses queued.
 */
async function accept(rows: QueuedOp[], results: OpResult[], userId: number, out: SyncOutcome): Promise<number> {
  const byId = new Map(results.map((r) => [r.opId, r]));
  const inverses: QueuedInverse[] = [];
  for (const q of rows) {
    const inv = q.undo ? inverseOf(q.op, byId.get(q.op.opId)) : null;
    if (inv) inverses.push({ userId, op: inv, inverseOf: q.op.opId });
  }
  await removeQueued(rows.map((q) => q.op.opId), inverses);
  await setLastSentAt(Date.now()); // closes the quarantine circuit breaker
  out.sent += rows.length;
  out.results.push(...results);
  out.undone.push(...undoIds(rows));
  return inverses.length;
}

/**
 * The canary for `headId` among the rows from `rows[from]` on: the one with the fewest attempts, the
 * first in queue order on a tie, so a failed canary (one more attempt) gives way to another at the
 * next sync. Never a review whose consume is still queued before it (the head or an earlier row):
 * a review never goes out before its consume.
 */
function canaryFor(rows: QueuedOp[], from: number, headId: string): QueuedOp | undefined {
  const before = new Set([headId]);
  let best: QueuedOp | undefined;
  for (const q of rows.slice(from)) {
    const waitsForConsume = q.op.kind === 'review' && q.op.consumeOpId !== undefined && before.has(q.op.consumeOpId);
    if (!waitsForConsume && (!best || q.attempts < best.attempts)) best = q;
    before.add(q.op.opId);
  }
  return best;
}

/**
 * The head `headId` reached MAX_STRIKES with the breaker open: sends `canary` alone to tell a
 * general outage from a second faulty gesture. Accepted, it closes the breaker and the head is
 * quarantined (resolves true: list again). Otherwise the sync stops and nobody is struck: a failed
 * canary counts an attempt (it may have been applied), a 400 drops it, a 401/409 is `unauthorized`.
 */
async function sendCanary(canary: QueuedOp, headId: string, userId: number, doFetch: typeof fetch, out: SyncOutcome): Promise<boolean> {
  const res = await postOps([canary.op], userId, doFetch);
  if (res.kind === 'ok') {
    await accept([canary], res.results, userId, out);
    await quarantine(headId);
    out.quarantined.push(headId);
    return true;
  }
  if (res.kind === 'unauthorized') {
    out.status = 'unauthorized';
    return false;
  }
  if (res.kind === 'invalid') {
    await removeQueued([canary.op.opId]);
    out.dropped.push(canary.op);
    out.undone.push(...undoIds([canary]));
  } else {
    await bumpAttempts([canary.op.opId]);
  }
  out.status = 'retry';
  return false;
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
    const res = await postOps(ops, userId, doFetch);
    if (res.kind === 'unauthorized') {
      out.status = 'unauthorized'; // nothing removed, no attempt counted: sent again once logged back in as this user
      break;
    }
    if (res.kind === 'invalid') {
      // Never accepted, so never applied: keep it from blocking the queue. Nothing to undo either.
      await removeQueued(ids);
      out.dropped.push(...ops);
      out.undone.push(...undoIds(rows));
      continue;
    }
    if (res.kind === 'failed') {
      await bumpAttempts(ids); // attempts > 0: from now on the batch may have been applied
      // Blame the head of the batch only when the server is reachable (not a network outage).
      if (res.answered || (await serverReachable(doFetch))) {
        const head = ids[0];
        if ((await strike(head)) >= MAX_STRIKES) {
          if (!(await breakerOpen(userId, head))) {
            await quarantine(head);
            out.quarantined.push(head);
            return true; // list again: the reviews it holds back and the gestures after it are recomputed
          }
          // Breaker open: a canary tells a general outage from a second faulty gesture, which would
          // otherwise block the queue for good. No canary: nothing waits behind the head.
          const canary = canaryFor(queued, i, head);
          if (canary) return sendCanary(canary, head, userId, doFetch, out);
        }
      }
      out.status = 'retry';
      break;
    }
    inversesQueued += await accept(rows, res.results, userId, out);
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
 * consecutive unstruck rows. A failed batch whose failure is imputable to the app (its own HTTP
 * answer; after a network error, a timeout or a 502/503/504, a 2xx from /healthz) strikes its head gesture. At
 * MAX_STRIKES the head is quarantined (listed in `quarantined`) and the queue is listed again, so
 * what follows is still sent in this sync (within MAX_PASSES); otherwise the sync stops on `retry`.
 * Circuit breaker: no new quarantine while another gesture is quarantined and no batch was accepted
 * since (see breakerOpen). The head keeps its strikes and one canary goes alone (see canaryFor: the
 * sendable row after it with the fewest attempts, never a review whose consume is still queued): accepted, the head is quarantined and the sync goes on; otherwise
 * (general outage) the sync stops on `retry` with no strike on either. No canary: `retry` too.
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
