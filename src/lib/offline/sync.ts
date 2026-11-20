// Sends the offline queue to the server. Framework-free (no $app/*, no runes): the service worker imports it.
import { inverseOf } from './inverse';
import { bumpAttempts, listQueued, removeQueued, type QueuedInverse, type QueuedOp } from './queue';
import type { OpResult, StockOp } from '$lib/stock-ops';

/** Same value as MAX_OPS_PER_REQUEST on the server (a $lib/server module cannot be bundled here). */
export const SYNC_BATCH_SIZE = 100;
/** A request hanging on a flaky network would hold the sync lock forever: give up and retry later. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Shared by the tabs and the service worker. */
const LOCK_NAME = 'apogee-sync';

export type SyncStatus = 'ok' | 'offline' | 'retry' | 'unauthorized' | 'idle' | 'busy';
/**
 * `undone`: opIds among `results` and `dropped` sent for an undo (undone gestures and their
 * inverses): no news for the user, who asked for it.
 */
export type SyncOutcome = { sent: number; results: OpResult[]; dropped: StockOp[]; undone: string[]; status: SyncStatus };
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

const timeoutSignal = (): AbortSignal | undefined =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;

export type PostOutcome =
  | { kind: 'ok'; results: OpResult[] }
  | { kind: 'invalid' } // 400: the server will never accept these ops
  | { kind: 'unauthorized' } // 401, or 409: the session belongs to another account than the ops
  | { kind: 'failed' }; // 5xx, network failure, timeout or unreadable body: maybe applied, replay later

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
  try {
    const res = await doFetch('/api/stock/ops', {
      method: 'POST',
      headers: opsHeaders(userId),
      body: JSON.stringify({ ops }),
      credentials: 'same-origin',
      signal: timeoutSignal()
    });
    if (res.status === 401 || res.status === 409) return { kind: 'unauthorized' };
    if (res.status === 400) return { kind: 'invalid' };
    if (res.ok) {
      const body = (await res.json()) as { results?: unknown };
      if (Array.isArray(body.results)) return { kind: 'ok', results: body.results as OpResult[] };
    }
  } catch {
    // fall through
  }
  return { kind: 'failed' };
}

/** At most this many passes over the queue per sync: the inverses queued by one pass go in the next. */
const MAX_PASSES = 3;

async function run(userId: number, doFetch: typeof fetch): Promise<SyncOutcome> {
  const out: SyncOutcome = { sent: 0, results: [], dropped: [], undone: [], status: 'ok' };
  let queued = await listQueued(userId);
  if (queued.length === 0) return { ...out, status: 'idle' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ...out, status: 'offline' };

  for (let pass = 0; pass < MAX_PASSES && queued.length > 0; pass++) {
    const inversesQueued = await sendQueued(queued, userId, doFetch, out);
    if (out.status !== 'ok' || inversesQueued === 0) break;
    queued = await listQueued(userId); // the inverses just queued go in this same sync
  }
  return out;
}

/** One pass over `queued`, in batches, filling `out`. Returns how many inverses it queued. */
async function sendQueued(queued: QueuedOp[], userId: number, doFetch: typeof fetch, out: SyncOutcome): Promise<number> {
  let inversesQueued = 0;
  for (let i = 0; i < queued.length; i += SYNC_BATCH_SIZE) {
    const rows = queued.slice(i, i + SYNC_BATCH_SIZE);
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
  return inversesQueued;
}

/**
 * Sends the user's queued ops in arrival order, in batches of SYNC_BATCH_SIZE. 2xx removes them,
 * 400 drops them (`dropped`), 401 keeps everything (`unauthorized`), 5xx or a network failure keeps
 * the rest and counts an attempt (`retry`). A call made while another sync runs returns `busy`.
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
  return out ?? { sent: 0, results: [], dropped: [], undone: [], status: 'busy' };
}
