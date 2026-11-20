/**
 * The current user's stock gestures not yet reflected in the page data, for the optimistic overlay,
 * plus the sync loop and the recent results "Annuler" needs. Client only.
 */
import { goto, invalidateAll } from '$app/navigation';
import * as m from '$paraglide/messages';
import { showToast } from '$lib/toast.svelte';
import { listQueued } from './queue';
import { onSyncOutcome, syncNow, type SyncOutcome } from './sync';
import type { OpResult, StockOp } from '$lib/server/stock';

const RETRY_EVERY_MS = 30_000;
const BACKGROUND_SYNC_TAG = 'apogee-stock-sync';
const MAX_RESULTS = 200;

/**
 * `gen === null`: still queued. A number: applied by the server, kept on screen until the page data
 * that includes it is loaded (the reload started after `gen` was assigned clears it), so the count
 * never flashes back to its old value.
 */
type Entry = { op: StockOp; gen: number | null };

const state = $state<{ entries: Entry[] }>({ entries: [] });
let gen = 0;
/** Bumped on every local change, so a slower read of the queue cannot overwrite a newer state. */
let version = 0;

/** Recent server results by opId (from every sync and direct send): "Annuler" builds the inverse op from them. */
const results = new Map<string, OpResult>();
/** Ops whose sendStockOps caller is waiting for the result and reports it itself. */
const claimed = new Set<string>();
/** The follow-ups (queue re-read, warning, reload) of the syncs, chained in order. */
let settling: Promise<void> = Promise.resolve();

/** Ops to overlay on the page data (reactive). */
export function pendingOps(): StockOp[] {
  return state.entries.map((e) => e.op);
}

/** Gestures still waiting to be sent (reactive). */
export function pendingCount(): number {
  return state.entries.filter((e) => e.gen === null).length;
}

export function rememberResults(list: OpResult[]): void {
  for (const r of list) {
    results.delete(r.opId);
    results.set(r.opId, r);
  }
  while (results.size > MAX_RESULTS) results.delete(results.keys().next().value as string);
}

export function resultFor(opId: string): OpResult | undefined {
  return results.get(opId);
}

/** Shows ops at once, before they are even stored. */
export function trackOps(ops: StockOp[]): void {
  const known = new Set(state.entries.map((e) => e.op.opId));
  const added = ops.filter((o) => !known.has(o.opId)).map((op) => ({ op, gen: null }));
  if (added.length === 0) return;
  version++;
  state.entries = [...state.entries, ...added];
}

export function forgetOps(opIds: string[]): void {
  const ids = new Set(opIds);
  version++;
  state.entries = state.entries.filter((e) => !ids.has(e.op.opId));
}

/** Marks ops as handled by the caller (no warning toast, no reload from here). Returns the release. */
export function claimOps(ops: StockOp[]): () => void {
  for (const o of ops) claimed.add(o.opId);
  return () => {
    for (const o of ops) claimed.delete(o.opId);
  };
}

/** Reloads the page data, then drops the applied ops it now includes. */
export async function reload(): Promise<void> {
  const upTo = gen;
  await invalidateAll();
  version++;
  state.entries = state.entries.filter((e) => e.gen === null || e.gen > upTo);
}

/** Replaces the queued entries with the queue's content (applied ones stay until the next reload). */
export async function refreshPending(userId: number): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const v = version;
    const queued = await listQueued(userId);
    if (v !== version) continue; // changed meanwhile: read again
    const applied = state.entries.filter((e) => e.gen !== null);
    const appliedIds = new Set(applied.map((e) => e.op.opId));
    state.entries = [
      ...applied,
      ...queued.filter((q) => !appliedIds.has(q.op.opId)).map((q) => ({ op: q.op, gen: null }))
    ];
    return;
  }
}

/** Asks the service worker to sync when the network is back, even if the tab is closed. */
export function requestBackgroundSync(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register(BACKGROUND_SYNC_TAG))
    .catch(() => {});
}

// Every sync that runs in this tab feeds the results and the overlay, whoever started it.
onSyncOutcome((userId, out) => {
  rememberResults(out.results);
  rememberResults(out.dropped.map((o) => ({ opId: o.opId, status: 'rejected', reason: 'invalid' })));
  const byId = new Map(out.results.map((r) => [r.opId, r]));
  const dropped = new Set(out.dropped.map((o) => o.opId));
  version++;
  state.entries = state.entries.flatMap((e) => {
    if (dropped.has(e.op.opId)) return [];
    const r = byId.get(e.op.opId);
    if (!r) return [e];
    // A rejected op changed nothing on the server: stop showing it now.
    return r.status === 'rejected' ? [] : [{ op: e.op, gen: e.gen ?? ++gen }];
  });
  // Sorted now, while the waiting callers still hold their claims.
  const others = out.results.filter((r) => !claimed.has(r.opId));
  const othersDropped = out.dropped.filter((o) => !claimed.has(o.opId));
  settling = settling.then(() => afterSync(userId, others, othersDropped)).catch(() => {});
});

/** Re-reads the queue; for ops nobody is waiting on, warns about failures and reloads the data. */
async function afterSync(userId: number, others: OpResult[], othersDropped: StockOp[]): Promise<void> {
  await refreshPending(userId).catch(() => {});
  if (others.length === 0 && othersDropped.length === 0) return;
  const emptied = others.some((r) => r.status === 'partial' || (r.status === 'rejected' && r.reason === 'empty_lot'));
  const failed = othersDropped.length > 0 || others.some((r) => r.status === 'rejected' && r.reason !== 'empty_lot');
  if (emptied) showToast(m.drink_empty_lot());
  else if (failed) showToast(m.offline_op_failed());
  await reload();
}

/** Syncs the user's queue; a dead session sends to /login (the queue is kept for later). */
export async function syncPending(userId: number): Promise<SyncOutcome> {
  const out = await syncNow(userId);
  await settling;
  if (out.status === 'unauthorized') await goto('/login');
  return out;
}

/**
 * Keeps the queue flowing while the app is open: on start, when the network comes back, when the
 * tab becomes visible, and every 30 s while gestures wait. Returns the stop function.
 */
export function startSyncLoop(userId: number): () => void {
  const run = () => void syncPending(userId).catch(() => {});
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => {
    if (pendingCount() > 0) run();
  }, RETRY_EVERY_MS);
  void refreshPending(userId)
    .then(() => {
      if (pendingCount() === 0) return;
      requestBackgroundSync();
      run();
    })
    .catch(() => {});
  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}

/** Test helper. */
export function _resetPendingForTests(): void {
  state.entries = [];
  results.clear();
  claimed.clear();
  gen = 0;
  version++;
}
