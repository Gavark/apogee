/**
 * The current user's stock gestures not yet reflected in the page data, for the optimistic overlay,
 * plus the sync loop and the recent results "Annuler" needs. Client only.
 */
import { goto, invalidateAll } from '$app/navigation';
import * as m from '$paraglide/messages';
import { showToast } from '$lib/toast.svelte';
import { newOpId } from './op-id';
import { enqueue, listQueued } from './queue';
import { onSyncOutcome, syncIdle, syncNow, type SyncOutcome } from './sync';
import type { OpResult, StockOp } from '$lib/server/stock';

const RETRY_EVERY_MS = 30_000;
const BACKGROUND_SYNC_TAG = 'apogee-stock-sync';
const MAX_RESULTS = 200;

/**
 * `gen === null`: still queued. A number: applied by the server, kept on screen until the page data
 * that includes it is loaded (the reload started after `gen` was assigned clears it), so the count
 * never flashes back to its old value.
 * `stored`: written to IndexedDB (a tracked op not stored yet is not "gone from the queue").
 * `hidden`: undone by the user but maybe already applied: kept queued, no longer shown.
 * Everything here belongs to one user (`owner`): another user in the tab starts from a clean slate.
 */
type Entry = { op: StockOp; gen: number | null; stored: boolean; hidden?: boolean };

const state = $state<{ entries: Entry[] }>({ entries: [] });
let gen = 0;
/** Bumped on every local change, so a slower read of the queue cannot overwrite a newer state. */
let version = 0;

/** Recent server results by opId (from every sync and direct send): "Annuler" builds the inverse op from them. */
const results = new Map<string, OpResult>();
/** Ops whose sendStockOps caller is waiting for the result and reports it itself. */
const claimed = new Set<string>();
/** Gestures undone while their fate was unknown: their inverse is sent once their result arrives. */
const undoOnResult = new Map<string, StockOp>();
/** The user the state above belongs to. */
let owner: number | null = null;
/** The follow-ups (queue re-read, warning, reload) of the syncs, chained in order. */
let settling: Promise<void> = Promise.resolve();

/**
 * Makes `userId` the owner of the pending state. When it changes (another account logged in in this
 * tab), the previous user's entries, results and pending undos are dropped from memory: their queue
 * rows stay in IndexedDB, untouched, and are never sent under the new account.
 */
export function usePendingFor(userId: number): void {
  if (owner === userId) return;
  owner = userId;
  version++;
  state.entries = [];
  results.clear();
  undoOnResult.clear();
}

/** Ops to overlay on the page data (reactive). */
export function pendingOps(): StockOp[] {
  return state.entries.filter((e) => !e.hidden).map((e) => e.op);
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

/** The op that cancels `op`, given its server result; null when there is nothing (or no way) to undo. */
export function inverseOf(op: StockOp, r: OpResult | undefined): StockOp | null {
  if (!r || r.status === 'rejected') return null;
  if (op.kind === 'consume' && r.consumptionId !== undefined) {
    return { opId: newOpId(), kind: 'unconsume', consumptionId: r.consumptionId };
  }
  if (op.kind === 'adjust' && r.appliedQuantity) {
    return { opId: newOpId(), kind: 'adjust', lotId: op.lotId, delta: -r.appliedQuantity };
  }
  return null;
}

/** Shows ops at once, before they are even stored. */
export function trackOps(ops: StockOp[]): void {
  const known = new Set(state.entries.map((e) => e.op.opId));
  const added = ops.filter((o) => !known.has(o.opId)).map((op) => ({ op, gen: null, stored: false }));
  if (added.length === 0) return;
  version++;
  state.entries = [...state.entries, ...added];
}

/** The tracked ops are now in IndexedDB. */
export function markStored(opIds: string[]): void {
  const ids = new Set(opIds);
  version++;
  state.entries = state.entries.map((e) => (ids.has(e.op.opId) ? { ...e, stored: true } : e));
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

/**
 * Applies server results to the overlay: applied/partial ops wait for the next reload, rejected
 * and dropped ones (nothing changed on the server) stop showing at once.
 */
export function applyResults(list: OpResult[], droppedIds: string[] = []): void {
  rememberResults(list);
  rememberResults(droppedIds.map((opId) => ({ opId, status: 'rejected', reason: 'invalid' })));
  const byId = new Map(list.map((r) => [r.opId, r]));
  const dropped = new Set(droppedIds);
  version++;
  state.entries = state.entries.flatMap((e) => {
    if (dropped.has(e.op.opId)) return [];
    const r = byId.get(e.op.opId);
    if (!r) return [e];
    return r.status === 'rejected' ? [] : [{ ...e, gen: e.gen ?? ++gen }];
  });
}

/**
 * The user undid `op` but it may already be applied (an earlier attempt got no clear answer):
 * stop showing it, keep it queued, and send its inverse once its result is known.
 */
export function undoWhenSynced(op: StockOp): void {
  undoOnResult.set(op.opId, op);
  version++;
  state.entries = state.entries.map((e) => (e.op.opId === op.opId ? { ...e, hidden: true } : e));
}

/** Reloads the page data, then drops the applied ops it now includes. */
export async function reload(): Promise<void> {
  const upTo = gen;
  await invalidateAll();
  version++;
  state.entries = state.entries.filter((e) => e.gen === null || e.gen > upTo);
}

/**
 * Replaces the queued entries with the queue's content (applied ones stay until the next reload).
 * Stored entries gone from the queue with no result here were sent by another context (tab, service
 * worker): treated as applied. Returns them, so the caller reloads the data.
 */
export async function refreshPending(userId: number): Promise<StockOp[]> {
  for (let i = 0; i < 3; i++) {
    if (userId !== owner) return []; // a late follow-up for a previous user
    const v = version;
    const queued = await listQueued(userId);
    if (v !== version) continue; // changed meanwhile (maybe the user): check again
    const inQueue = new Map(queued.map((q) => [q.op.opId, q.op]));
    const vanished: StockOp[] = [];
    const kept = state.entries.flatMap((e): Entry[] => {
      if (e.gen !== null || inQueue.has(e.op.opId)) return [e];
      if (!e.stored) return [e]; // being written right now
      vanished.push(e.op);
      // An undone one stays as is: it is replayed to learn its result (see afterSync).
      return undoOnResult.has(e.op.opId) ? [e] : [{ ...e, gen: ++gen }];
    });
    const keptIds = new Set(kept.map((e) => e.op.opId));
    state.entries = [
      ...kept,
      ...queued.filter((q) => !keptIds.has(q.op.opId)).map((q) => ({ op: q.op, gen: null, stored: true }))
    ];
    return vanished;
  }
  return [];
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
  if (userId !== owner) return; // not the state on screen
  applyResults(
    out.results,
    out.dropped.map((o) => o.opId)
  );
  // Gestures undone while uncertain: now that their result is known, build their inverse.
  const inverses: StockOp[] = [];
  const undone = new Set<string>();
  for (const r of out.results) {
    const op = undoOnResult.get(r.opId);
    if (!op) continue;
    undoOnResult.delete(r.opId);
    undone.add(r.opId);
    const inv = inverseOf(op, r);
    if (inv) inverses.push(inv);
  }
  for (const o of out.dropped) undoOnResult.delete(o.opId); // never applied: nothing to undo
  // Sorted now, while the waiting callers still hold their claims. An undone gesture is no news.
  const others = out.results.filter((r) => !claimed.has(r.opId) && !undone.has(r.opId));
  const othersDropped = out.dropped.filter((o) => !claimed.has(o.opId));
  const changed = others.length > 0 || othersDropped.length > 0 || undone.size > 0;
  settling = settling.then(() => afterSync(userId, others, othersDropped, inverses, changed)).catch(() => {});
});

/**
 * Queues and sends ops on the user's behalf: inverses of gestures undone while uncertain, or such
 * a gesture replayed (idempotent) to learn its result. They stay queued if the network fails again.
 */
async function sendQuietly(userId: number, ops: StockOp[]): Promise<StockOp[]> {
  if (userId !== owner) return []; // only ever on behalf of the user the ops belong to
  const release = claimOps(ops); // reported by the reload below, not by a warning
  try {
    trackOps(ops);
    const added: StockOp[] = [];
    for (const op of ops) if (await enqueue(userId, op)) added.push(op);
    markStored(ops.map((o) => o.opId));
    if (added.length > 0) {
      await syncIdle(); // the sync that brought the results may still hold the lock
      await syncNow(userId);
    }
    return added;
  } finally {
    release();
  }
}

/**
 * Sends pending inverses, re-reads the queue; for ops nobody is waiting on, warns about failures;
 * reloads the data when something changed out of a caller's sight.
 */
async function afterSync(
  userId: number,
  others: OpResult[],
  othersDropped: StockOp[],
  inverses: StockOp[],
  changed: boolean
): Promise<void> {
  if (userId !== owner) return; // the user changed since: nothing of theirs on screen any more
  if (inverses.length > 0) await sendQuietly(userId, inverses).catch(() => {});
  const vanished = await refreshPending(userId).catch((): StockOp[] => []);
  // An undone gesture sent by another context: its result is unknown here, replay it to get it.
  const replay = vanished.filter((op) => undoOnResult.has(op.opId));
  if (replay.length > 0) {
    const added = new Set((await sendQuietly(userId, replay).catch((): StockOp[] => [])).map((o) => o.opId));
    // Not re-queued (its opId is held by another row, or the user changed): its result cannot be
    // learnt from here. Give up on that undo rather than replay forever; the reload shows the truth.
    const lost = replay.filter((o) => !added.has(o.opId)).map((o) => o.opId);
    if (lost.length > 0) {
      for (const id of lost) undoOnResult.delete(id);
      version++;
      state.entries = state.entries.map((e) => (lost.includes(e.op.opId) && e.gen === null ? { ...e, gen: ++gen } : e));
    }
  }
  if (!changed && vanished.length === 0) return;
  const emptied = others.some((r) => r.status === 'partial' || (r.status === 'rejected' && r.reason === 'empty_lot'));
  const failed = othersDropped.length > 0 || others.some((r) => r.status === 'rejected' && r.reason !== 'empty_lot');
  if (emptied) showToast(m.drink_empty_lot());
  else if (failed) showToast(m.offline_op_failed());
  await reload();
}

/** Syncs the user's queue; a dead session sends to /login (the queue is kept for later). */
export async function syncPending(userId: number): Promise<SyncOutcome> {
  const out = await syncNow(userId);
  // Follow-ups may start further syncs (inverses): wait until the chain stops growing.
  let s: Promise<void>;
  do {
    s = settling;
    await s;
  } while (s !== settling);
  if (out.status === 'unauthorized') await goto('/login');
  return out;
}

/**
 * Keeps the queue flowing while the app is open: on start, when the network comes back, when the
 * tab becomes visible, and every 30 s while gestures wait. Returns the stop function.
 */
export function startSyncLoop(userId: number): () => void {
  usePendingFor(userId);
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
  owner = null;
  state.entries = [];
  results.clear();
  claimed.clear();
  undoOnResult.clear();
  gen = 0;
  version++;
}
