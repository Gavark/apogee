/**
 * The current user's stock gestures not yet reflected in the page data, for the optimistic overlay,
 * plus the sync loop and the recent results "Annuler" needs. Client only.
 */
import { goto, invalidateAll } from '$app/navigation';
import * as m from '$paraglide/messages';
import { showToast } from '$lib/toast.svelte';
import { listQueued, releaseQuarantine, removeQueued, splitQuarantine, type QuarantineItem } from './queue';
import { MAX_STRIKES, onSyncOutcome, syncIdle, syncNow, withSyncLock, type SyncOutcome } from './sync';
import type { OpResult, StockOp } from '$lib/server/stock';

const RETRY_EVERY_MS = 30_000;
const BACKGROUND_SYNC_TAG = 'apogee-stock-sync';
const MAX_RESULTS = 200;

/**
 * `gen === null`: still queued. A number: applied by the server, kept on screen until the page data
 * that includes it is loaded (the reload started after `gen` was assigned clears it), so the count
 * never flashes back to its old value.
 * `stored`: written to IndexedDB (a tracked op not stored yet is not "gone from the queue").
 * `hidden`: undone by the user but maybe already applied: kept queued (its row flagged `undo`, see
 * queue.ts: whoever sends it queues its inverse), no longer shown.
 * Everything here belongs to one user (`owner`): another user in the tab starts from a clean slate.
 */
type Entry = { op: StockOp; gen: number | null; stored: boolean; hidden?: boolean };

/**
 * `quarantine`: the owner's quarantined gestures, with the reviews they hold back. Neither is in
 * `entries`: off the overlay and the pending count, the screen shows the server's state.
 */
const state = $state<{ entries: Entry[]; quarantine: QuarantineItem[] }>({ entries: [], quarantine: [] });
let gen = 0;
/** Bumped on every local change, so a slower read of the queue cannot overwrite a newer state. */
let version = 0;

/** Recent server results by opId (from every sync and direct send): "Annuler" builds the inverse op from them. */
const results = new Map<string, OpResult>();
/** Ops whose sendStockOps caller is waiting for the result and reports it itself. */
const claimed = new Set<string>();
/** Gestures made in this tab by the owner (most recent last): only those may be replayed to undo them. */
const ownGestures = new Set<string>();
/** Gestures being retried by the user: a new quarantine gets retryQuarantined's own toast. */
const retrying = new Set<string>();
/** The user the state above belongs to. */
let owner: number | null = null;
/** The follow-ups (queue re-read, warning, reload) of the syncs, chained in order. */
let settling: Promise<void> = Promise.resolve();

/**
 * Makes `userId` the owner of the pending state. When it changes (another account logged in in this
 * tab), the previous user's entries and results are dropped from memory: their queue
 * rows stay in IndexedDB, untouched, and are never sent under the new account.
 */
export function usePendingFor(userId: number): void {
  if (owner === userId) return;
  owner = userId;
  version++;
  state.entries = [];
  state.quarantine = [];
  results.clear();
  ownGestures.clear();
}

/** The owner's quarantined gestures, each with the reviews held back with it (reactive). */
export function quarantinedItems(): QuarantineItem[] {
  return state.quarantine;
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

/** Whether this tab made the gesture, for the current owner (its result may still be unknown here). */
export function isOwnGesture(opId: string): boolean {
  return ownGestures.has(opId);
}

/** Shows ops at once, before they are even stored. */
export function trackOps(ops: StockOp[]): void {
  for (const o of ops) ownGestures.add(o.opId);
  while (ownGestures.size > MAX_RESULTS) ownGestures.delete(ownGestures.values().next().value as string);
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
 * The user undid `opId` but it may already be applied (an earlier attempt got no clear answer):
 * its queue row now carries the undo (markUndo); stop showing it.
 */
export function hideUndone(opId: string): void {
  version++;
  state.entries = state.entries.map((e) => (e.op.opId === opId ? { ...e, hidden: true } : e));
}

/** Reloads the page data, then drops the applied ops it now includes. */
export async function reload(): Promise<void> {
  const upTo = gen;
  await invalidateAll();
  version++;
  state.entries = state.entries.filter((e) => e.gen === null || e.gen > upTo);
}

/**
 * Replaces the queued entries with the queue's content (applied ones stay until the next reload;
 * rows flagged `undo` stay hidden, also after the app was closed). Stored entries gone from the
 * queue with no result here were sent by another context (tab, service worker), which also queued
 * the inverse of an undone one: treated as applied. Returns them, so the caller reloads the data.
 * Quarantined gestures, and the reviews they hold back, leave the entries for `state.quarantine`
 * (still queued: never taken for sent elsewhere).
 */
export async function refreshPending(userId: number): Promise<StockOp[]> {
  for (let i = 0; i < 3; i++) {
    if (userId !== owner) return []; // a late follow-up for a previous user
    const v = version;
    const all = await listQueued(userId);
    if (v !== version) continue; // changed meanwhile (maybe the user): check again
    const { sendable: queued, quarantined } = splitQuarantine(all);
    const blocked = new Set(quarantined.flatMap((i) => [i.row.op.opId, ...i.held.map((h) => h.op.opId)]));
    const inQueue = new Map(queued.map((q) => [q.op.opId, q]));
    const vanished: StockOp[] = [];
    const kept = state.entries.flatMap((e): Entry[] => {
      if (e.gen !== null) return [e];
      if (blocked.has(e.op.opId)) return [];
      const q = inQueue.get(e.op.opId);
      if (q) return [q.undo ? { ...e, hidden: true } : e];
      if (!e.stored) return [e]; // being written right now
      vanished.push(e.op);
      return [{ ...e, gen: ++gen }];
    });
    const keptIds = new Set(kept.map((e) => e.op.opId));
    state.entries = [
      ...kept,
      ...queued
        .filter((q) => !keptIds.has(q.op.opId))
        .map((q): Entry => ({ op: q.op, gen: null, stored: true, ...(q.undo ? { hidden: true } : {}) }))
    ];
    state.quarantine = quarantined;
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

/**
 * Every sync feeds the results and the overlay, whoever ran it: this tab (onSyncOutcome) or the
 * service worker's Background Sync (its `sync-outcome` message, see startSyncLoop).
 */
function handleOutcome(userId: number, out: SyncOutcome): void {
  if (userId !== owner) return; // not the state on screen
  // Known before applyResults drops the rejected entries: a rejected verdict is no failure to report
  // (its "Bue" was undone or is gone), the data is still reloaded.
  const reviews = new Set(state.entries.filter((e) => e.op.kind === 'review').map((e) => e.op.opId));
  applyResults(
    out.results,
    out.dropped.map((o) => o.opId)
  );
  // Sorted now, while the waiting callers still hold their claims. An undo (the undone gesture and
  // its inverse, both handled by the sync itself) is no news: the data is just reloaded.
  const undone = new Set(out.undone);
  const others = out.results.filter((r) => !claimed.has(r.opId) && !undone.has(r.opId));
  const othersDropped = out.dropped.filter((o) => !claimed.has(o.opId) && !undone.has(o.opId));
  // A gesture the user is retrying gets retryQuarantined's own toast, should it fail again.
  const quarantined = out.quarantined.some((id) => !retrying.has(id));
  const changed = others.length > 0 || othersDropped.length > 0 || undone.size > 0 || quarantined;
  settling = settling.then(() => afterSync(userId, others, othersDropped, changed, reviews, quarantined)).catch(() => {});
}

onSyncOutcome(handleOutcome);

/** A `{ type: 'sync-outcome' }` message from the service worker, or null for anything else. */
function swOutcome(data: unknown): { userId: number; outcome: SyncOutcome } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { type?: unknown; userId?: unknown; outcome?: Partial<SyncOutcome> | null };
  const o = d.outcome;
  if (d.type !== 'sync-outcome' || typeof d.userId !== 'number' || !o) return null;
  if (!Array.isArray(o.results) || !Array.isArray(o.dropped) || typeof o.status !== 'string') return null;
  // `undone` and `quarantined` are missing from a service worker of an older version.
  return {
    userId: d.userId,
    outcome: {
      ...(o as SyncOutcome),
      undone: Array.isArray(o.undone) ? o.undone : [],
      quarantined: Array.isArray(o.quarantined) ? o.quarantined : []
    }
  };
}

/**
 * Re-reads the queue; for ops nobody is waiting on, warns about failures; reloads the data when
 * something changed out of a caller's sight.
 */
async function afterSync(
  userId: number,
  others: OpResult[],
  othersDropped: StockOp[],
  changed: boolean,
  reviews: Set<string>,
  quarantined: boolean
): Promise<void> {
  if (userId !== owner) return; // the user changed since: nothing of theirs on screen any more
  const vanished = await refreshPending(userId).catch((): StockOp[] => []);
  if (!changed && vanished.length === 0) return;
  const emptied = others.some((r) => r.status === 'partial' || (r.status === 'rejected' && r.reason === 'empty_lot'));
  const failed = othersDropped.length > 0 || others.some((r) => r.status === 'rejected' && r.reason !== 'empty_lot' && !reviews.has(r.opId));
  if (emptied) showToast(m.drink_empty_lot());
  else if (failed) showToast(m.offline_op_failed());
  else if (quarantined) showToast(m.offline_op_quarantined());
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
 * « Réessayer »: lifts the quarantine with MAX_STRIKES - 1 strikes, so the gesture goes alone and
 * one more imputable failure quarantines it again (toast « Toujours impossible à envoyer »), then
 * syncs at once. Without the server it is an ordinary pending gesture again.
 */
export async function retryQuarantined(userId: number, opId: string): Promise<void> {
  usePendingFor(userId);
  retrying.add(opId);
  try {
    const released = await withSyncLock(() => releaseQuarantine(opId, MAX_STRIKES - 1));
    await refreshPending(userId);
    if (!released) return; // gone meanwhile (sent or abandoned elsewhere)
    const out = await syncPending(userId);
    if (out.status === 'busy') {
      // A sync already running may have listed the queue before the release: run another one after it.
      await syncIdle();
      await syncPending(userId);
    }
    const row = (await listQueued(userId)).find((q) => q.op.opId === opId);
    if (row?.quarantinedAt !== undefined) showToast(m.quarantine_still_failing());
    else if (row) requestBackgroundSync(); // still pending: sent once the network allows
  } finally {
    retrying.delete(opId);
  }
}

/**
 * « Abandonner »: deletes the quarantined gesture and the reviews it holds back, never sent. No
 * inverse is queued, even for an undone one: nothing of it is known to be applied. Then reloads.
 */
export async function abandonQuarantined(userId: number, opId: string): Promise<void> {
  usePendingFor(userId);
  // Under the lock, from the queue itself: a review added since the list was drawn goes too.
  const removed = await withSyncLock(async () => {
    const item = splitQuarantine(await listQueued(userId)).quarantined.find((i) => i.row.op.opId === opId);
    if (!item) return false; // released or gone meanwhile: nothing to abandon
    await removeQueued([opId, ...item.held.map((h) => h.op.opId)]);
    return true;
  });
  await refreshPending(userId);
  if (!removed) return;
  await reload();
  showToast(m.quarantine_abandoned());
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
  // Results of the service worker's Background Sync (another user's are ignored by handleOutcome).
  const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
  const onMessage = (e: MessageEvent) => {
    const msg = swOutcome(e.data);
    if (msg) handleOutcome(msg.userId, msg.outcome);
  };
  sw?.addEventListener('message', onMessage);
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
    sw?.removeEventListener('message', onMessage);
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}

/** Test helper. */
export function _resetPendingForTests(): void {
  owner = null;
  state.entries = [];
  state.quarantine = [];
  results.clear();
  ownGestures.clear();
  claimed.clear();
  retrying.clear();
  gen = 0;
  version++;
}
