import { goto } from '$app/navigation';
import { page } from '$app/state';
import * as m from '$paraglide/messages';
import { enqueue, listQueued, removeQueued } from '$lib/offline/queue';
import { syncIdle, syncNow, withSyncLock } from '$lib/offline/sync';
import {
  claimOps,
  forgetOps,
  rememberResults,
  reload,
  requestBackgroundSync,
  resultFor,
  trackOps
} from '$lib/offline/pending.svelte';
import { showToast } from '$lib/toast.svelte';
import type { OpResult, StockOp } from '$lib/server/stock';

/** A server result, or `queued`: stored on the device, sent once the network allows. */
export type ClientOpResult = OpResult | { opId: string; status: 'queued' };

/** A fresh idempotency key. randomUUID needs a secure context; plain-http LAN access falls back. */
export function newOpId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The session is gone (HTTP 401): the user has been sent to /login, callers should stay silent. */
export class SessionExpiredError extends Error {
  constructor() {
    super('session expired');
  }
}

/** Posts the ops straight away; rejects on a network or HTTP failure (SessionExpiredError after redirecting on a 401). */
async function sendDirect(ops: StockOp[]): Promise<OpResult[]> {
  const res = await fetch('/api/stock/ops', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ops })
  });
  if (res.status === 401) {
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
 * failure; on a 401 redirects to /login and rejects with SessionExpiredError, the ops staying queued.
 * Without a logged-in user (no queue owner), sends directly as before.
 */
export async function sendStockOps(ops: StockOp[]): Promise<ClientOpResult[]> {
  const userId = currentUserId();
  if (userId === undefined) return sendDirect(ops);

  trackOps(ops);
  const release = claimOps(ops);
  try {
    try {
      for (const op of ops) await enqueue(userId, op);
    } catch {
      // No usable IndexedDB (storage blocked, private mode): no offline mode, send directly.
      forgetOps(ops.map((o) => o.opId));
      return await sendDirect(ops);
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

/** The op that cancels `op`, given its server result; null when there is nothing (or no way) to undo. */
function inverseOf(op: StockOp, r: OpResult | undefined): StockOp | null {
  if (!r || r.status === 'rejected') return null;
  if (op.kind === 'consume' && r.consumptionId !== undefined) {
    return { opId: newOpId(), kind: 'unconsume', consumptionId: r.consumptionId };
  }
  if (op.kind === 'adjust' && r.appliedQuantity) {
    return { opId: newOpId(), kind: 'adjust', lotId: op.lotId, delta: -r.appliedQuantity };
  }
  return null;
}

/**
 * Cancels a gesture: still queued → removed from the queue, nothing is ever sent (`unqueued`);
 * already applied → sends the inverse op built from its result (that op's result); result unknown → null.
 */
export async function undoStockOp(op: StockOp): Promise<ClientOpResult | 'unqueued' | null> {
  const userId = currentUserId();
  if (userId !== undefined) {
    // Under the sync lock: the op cannot be on its way to the server while we look.
    const removed = await withSyncLock(async () => {
      if (!(await listQueued(userId)).some((q) => q.op.opId === op.opId)) return false;
      await removeQueued([op.opId]);
      return true;
    }).catch(() => false);
    if (removed) {
      forgetOps([op.opId]);
      return 'unqueued';
    }
  }
  const inverse = inverseOf(op, resultFor(op.opId));
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
    } else if (r?.status === 'queued') {
      changed = false;
      showToast(m.offline_saved());
    } else if (r) {
      showToast(r.status === 'applied' ? m.wine_toast_undone() : m.wine_err_op());
    }
  } catch (e) {
    if (!(e instanceof SessionExpiredError)) showToast(m.wine_err_network());
  } finally {
    if (changed) await reload();
  }
}
