// Sends the offline queue to the server. Framework-free (no $app/*, no runes): the service worker imports it.
import { bumpAttempts, listQueued, removeQueued } from './queue';
import type { OpResult, StockOp } from '$lib/server/stock';

/** Same value as MAX_OPS_PER_REQUEST on the server (a $lib/server module cannot be bundled here). */
export const SYNC_BATCH_SIZE = 100;
/** A request hanging on a flaky network would hold the sync lock forever: give up and retry later. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Shared by the tabs and the service worker. */
const LOCK_NAME = 'apogee-sync';

export type SyncStatus = 'ok' | 'offline' | 'retry' | 'unauthorized' | 'idle' | 'busy';
export type SyncOutcome = { sent: number; results: OpResult[]; dropped: StockOp[]; status: SyncStatus };
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

async function run(userId: number, doFetch: typeof fetch): Promise<SyncOutcome> {
  const out: SyncOutcome = { sent: 0, results: [], dropped: [], status: 'ok' };
  const queued = await listQueued(userId);
  if (queued.length === 0) return { ...out, status: 'idle' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ...out, status: 'offline' };

  for (let i = 0; i < queued.length; i += SYNC_BATCH_SIZE) {
    const ops = queued.slice(i, i + SYNC_BATCH_SIZE).map((q) => q.op);
    const ids = ops.map((o) => o.opId);
    let results: OpResult[] | null = null;
    try {
      const res = await doFetch('/api/stock/ops', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ops }),
        credentials: 'same-origin',
        signal: timeoutSignal()
      });
      if (res.status === 401) {
        out.status = 'unauthorized'; // nothing removed: sent again once logged back in
        break;
      }
      if (res.status === 400) {
        // The server will never accept this batch: keep it from blocking the queue.
        await removeQueued(ids);
        out.dropped.push(...ops);
        continue;
      }
      if (res.ok) {
        const body = (await res.json()) as { results?: unknown };
        if (Array.isArray(body.results)) results = body.results as OpResult[];
      }
    } catch {
      // Network failure, timeout or unreadable body: ops are idempotent, the batch is replayed later.
    }
    if (!results) {
      await bumpAttempts(ids);
      out.status = 'retry';
      break;
    }
    await removeQueued(ids);
    out.sent += ops.length;
    out.results.push(...results);
  }
  return out;
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
  return out ?? { sent: 0, results: [], dropped: [], status: 'busy' };
}
