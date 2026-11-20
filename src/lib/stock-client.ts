import { goto } from '$app/navigation';
import { page } from '$app/state';
import * as m from '$paraglide/messages';
import { newOpId } from '$lib/offline/op-id';
import { inverseOf } from '$lib/offline/inverse';
import { enqueue, listQueued, markUndo, removeQueued } from '$lib/offline/queue';
import { opsHeaders, postOps, syncIdle, syncNow, withSyncLock } from '$lib/offline/sync';
import {
  applyResults,
  claimOps,
  forgetOps,
  hideUndone,
  isOwnGesture,
  markStored,
  rememberResults,
  reload,
  requestBackgroundSync,
  resultFor,
  trackOps,
  usePendingFor
} from '$lib/offline/pending.svelte';
import { showToast } from '$lib/toast.svelte';
import type { OpResult, StockOp } from '$lib/server/stock';

/** A server result, or `queued`: stored on the device, sent once the network allows. */
export type ClientOpResult = OpResult | { opId: string; status: 'queued' };

export { newOpId };

/**
 * The session is gone (HTTP 401) or belongs to another account (409): the user has been sent to
 * /login, callers should stay silent.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('session expired');
  }
}

/**
 * Posts the ops straight away, on behalf of `userId` when known; rejects on a network or HTTP
 * failure (SessionExpiredError after redirecting on a 401 or a 409).
 */
async function sendDirect(ops: StockOp[], userId?: number): Promise<OpResult[]> {
  const res = await fetch('/api/stock/ops', {
    method: 'POST',
    headers: opsHeaders(userId),
    body: JSON.stringify({ ops })
  });
  if (res.status === 401 || res.status === 409) {
    await goto('/login');
    throw new SessionExpiredError();
  }
  if (!res.ok) throw new Error(`stock ops failed: HTTP ${res.status}`);
  const { results } = (await res.json()) as { results: OpResult[] };
  rememberResults(results);
  return results;
}

const currentUserId = (): number | undefined => {
  const id = (page.data.user as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'number' ? id : undefined;
};

/**
 * Stores the ops in the offline queue, then tries to sync: resolves with each op's server result,
 * or `queued` when it could not be sent yet (no network, server error). Never rejects for a network
 * failure; on a 401 (or a 409: another account's session) redirects to /login and rejects with
 * SessionExpiredError, the ops staying queued.
 * Without a logged-in user (no queue owner), sends directly as before.
 */
export async function sendStockOps(ops: StockOp[]): Promise<ClientOpResult[]> {
  const userId = currentUserId();
  if (userId === undefined) return sendDirect(ops);

  usePendingFor(userId);
  trackOps(ops);
  const release = claimOps(ops);
  try {
    try {
      for (const op of ops) await enqueue(userId, op);
      markStored(ops.map((o) => o.opId));
    } catch {
      // No usable IndexedDB (storage blocked, private mode): no offline mode, send directly.
      forgetOps(ops.map((o) => o.opId));
      return await sendDirect(ops, userId);
    }
    let out = await syncNow(userId);
    if (out.status === 'busy') {
      // A sync started before our ops were stored may have missed them: run another one after it.
      await syncIdle();
      out = await syncNow(userId);
    }
    const known = ops.map((op) => resultFor(op.opId));
    if (known.every((r) => r !== undefined)) return known as OpResult[];
    if (out.status === 'unauthorized') {
      await goto('/login');
      throw new SessionExpiredError();
    }
    requestBackgroundSync();
    return ops.map((op, i) => known[i] ?? { opId: op.opId, status: 'queued' });
  } finally {
    release();
  }
}

/**
 * Cancels a gesture:
 * - queued and never attempted → removed from the queue, nothing is ever sent (`unqueued`);
 * - queued but attempted (5xx, lost reply: maybe applied) → replayed first (idempotent: the server
 *   answers with the stored result), then its inverse is sent; without network, the undo is recorded
 *   on the queued gesture, and the sync that learns its result queues and sends its inverse, even
 *   after the app was closed (`deferred`);
 * - already synced → sends the inverse built from its result; a gesture made here but synced by
 *   another context (result unknown here) is replayed first to learn it; otherwise null.
 * Resolves with the inverse op's result in the last two cases.
 */
export async function undoStockOp(op: StockOp): Promise<ClientOpResult | 'unqueued' | 'deferred' | null> {
  const userId = currentUserId();
  if (userId !== undefined) {
    usePendingFor(userId); // another user's gesture: not in this queue, no result kept → null
    // Under the sync lock: the op cannot be on its way to the server while we look.
    const step = await withSyncLock(async () => {
      const q = (await listQueued(userId)).find((x) => x.op.opId === op.opId);
      if (!q) return 'synced' as const;
      if (q.attempts === 0) {
        await removeQueued([op.opId]);
        return 'unqueued' as const;
      }
      const res = await postOps([op], userId);
      if (res.kind === 'invalid') {
        await removeQueued([op.opId]); // never accepted, so never applied
        return 'unqueued' as const;
      }
      if (res.kind === 'failed') {
        await markUndo(op.opId); // under the lock: no sync is sending it meanwhile
        return 'failed' as const;
      }
      if (res.kind !== 'ok') return res.kind;
      await removeQueued([op.opId]);
      applyResults(res.results);
      return 'synced' as const;
    }).catch(() => 'synced' as const);
    if (step === 'unqueued') {
      forgetOps([op.opId]);
      return 'unqueued';
    }
    if (step === 'unauthorized') {
      await goto('/login');
      throw new SessionExpiredError();
    }
    if (step === 'failed') {
      hideUndone(op.opId);
      requestBackgroundSync();
      return 'deferred';
    }
  }
  let known = resultFor(op.opId);
  if (known === undefined && userId !== undefined && isOwnGesture(op.opId)) {
    // Synced by another context (tab, service worker): replay it (idempotent per opId: the server
    // answers with its stored result, applying nothing) to learn what to undo.
    const res = await postOps([op], userId);
    if (res.kind === 'unauthorized') {
      await goto('/login');
      throw new SessionExpiredError();
    }
    if (res.kind === 'failed') throw new Error('undo: replay failed');
    if (res.kind === 'ok') {
      rememberResults(res.results);
      known = resultFor(op.opId);
    }
  }
  const inverse = inverseOf(op, known);
  if (!inverse) return null;
  const [r] = await sendStockOps([inverse]);
  return r;
}

/** The toast's « Annuler »: undoes the gesture, says how it went and refreshes the data when needed. */
export async function undoGesture(op: StockOp): Promise<void> {
  let changed = true;
  try {
    const r = await undoStockOp(op);
    if (r === 'unqueued') {
      changed = false;
      showToast(m.wine_toast_undone());
    } else if (r === 'deferred') {
      changed = false;
      showToast(m.offline_undo_deferred());
    } else if (r?.status === 'queued') {
      changed = false;
      showToast(m.offline_saved());
    } else {
      // null: nothing could be undone (result unknown, or nothing applied to cancel).
      showToast(r?.status === 'applied' ? m.wine_toast_undone() : m.wine_err_op());
    }
  } catch (e) {
    if (!(e instanceof SessionExpiredError)) showToast(m.wine_err_network());
  } finally {
    if (changed) await reload();
  }
}
