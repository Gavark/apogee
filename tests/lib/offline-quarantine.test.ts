import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { goto, invalidateAll, page } = vi.hoisted(() => ({
  goto: vi.fn(async () => {}),
  invalidateAll: vi.fn(async () => {}),
  page: { data: {} as { user?: { id: number } } }
}));
vi.mock('$app/navigation', () => ({ goto, invalidateAll }));
vi.mock('$app/state', () => ({ page }));

import { enqueue, listQueued, markUndo, quarantine, strike, _resetForTests } from '$lib/offline/queue';
import { MAX_STRIKES } from '$lib/offline/sync';
import {
  abandonQuarantined,
  markStored,
  pendingCount,
  pendingOps,
  quarantinedItems,
  refreshPending,
  retryQuarantined,
  startSyncLoop,
  syncPending,
  trackOps,
  usePendingFor,
  _resetPendingForTests
} from '$lib/offline/pending.svelte';
import { dismissToast, toast } from '$lib/toast.svelte';
import * as m from '$paraglide/messages';
import type { StockOp } from '$lib/server/stock';

const consume = (opId: string): StockOp => ({ opId, kind: 'consume', lotId: 7, consumedOn: '2026-11-20' });
const review = (opId: string, consumeOpId: string): StockOp => ({ opId, kind: 'review', consumeOpId, verdict: 'right', note: null });

const applied = (ops: StockOp[]) => new Response(JSON.stringify({ results: ops.map((o) => ({ opId: o.opId, status: 'applied' })) }));
const fail500 = () => new Response('boom', { status: 500 });

/** A fake server: /healthz answers `healthz`, /api/stock/ops answers `ops(batch)`; records the batches. */
function server(ops: (batch: StockOp[]) => Response, healthz = 200) {
  const batches: StockOp[][] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === '/healthz') return new Response('ok', { status: healthz });
    const { ops: batch } = JSON.parse(String(init?.body)) as { ops: StockOp[] };
    batches.push(batch);
    return ops(batch);
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, batches };
}
/** No network at all: every request (the probe included) fails. */
const offline = () => vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));

/** Queues `op` for user 1 and quarantines it after MAX_STRIKES strikes, as the sync would. */
async function seedQuarantined(op: StockOp): Promise<void> {
  await enqueue(1, op);
  for (let i = 0; i < MAX_STRIKES; i++) await strike(op.opId);
  await quarantine(op.opId);
}

const quarantinedIds = () => quarantinedItems().map((i) => i.row.op.opId);

beforeEach(() => {
  goto.mockClear();
  invalidateAll.mockClear();
  _resetForTests();
  globalThis.indexedDB = new IDBFactory();
  _resetPendingForTests();
  dismissToast();
  page.data = { user: { id: 1 } };
  usePendingFor(1);
});
afterEach(() => vi.unstubAllGlobals());

describe('état de quarantaine côté page', () => {
  it('refreshPending : geste en quarantaine absent de pendingOps et pendingCount, présent dans quarantinedItems', async () => {
    trackOps([consume('a')]); // shown before it was quarantined (by another context)
    markStored(['a']);
    await seedQuarantined(consume('a'));
    await enqueue(1, consume('b'));
    const vanished = await refreshPending(1);
    expect(vanished).toEqual([]); // still in the queue: never taken for sent elsewhere
    expect(pendingOps().map((o) => o.opId)).toEqual(['b']);
    expect(pendingCount()).toBe(1);
    expect(quarantinedIds()).toEqual(['a']);
    expect(quarantinedItems()[0].held).toEqual([]);
  });

  it('review retenu : absent de pendingOps, présent dans held', async () => {
    await seedQuarantined(consume('a'));
    await enqueue(1, review('r', 'a'));
    await refreshPending(1);
    expect(pendingOps()).toEqual([]);
    expect(pendingCount()).toBe(0);
    expect(quarantinedIds()).toEqual(['a']);
    expect(quarantinedItems()[0].held.map((h) => h.op.opId)).toEqual(['r']);
  });

  it('synchro qui met en quarantaine → toast offline_op_quarantined et invalidateAll appelé', async () => {
    await enqueue(1, consume('a'));
    for (let i = 0; i < MAX_STRIKES - 1; i++) await strike('a');
    await refreshPending(1);
    expect(pendingCount()).toBe(1);
    server(fail500);
    const out = await syncPending(1);
    expect(out.quarantined).toEqual(['a']);
    expect(toast.current?.message).toBe(m.offline_op_quarantined());
    expect(invalidateAll).toHaveBeenCalled();
    expect(pendingCount()).toBe(0);
    expect(quarantinedIds()).toEqual(['a']);
  });

  it('review rejeté → toujours aucun toast', async () => {
    await seedQuarantined(consume('q')); // an older quarantine is no news
    await enqueue(1, review('rv', 'gone'));
    await refreshPending(1);
    server((batch) => new Response(JSON.stringify({ results: batch.map((o) => ({ opId: o.opId, status: 'rejected', reason: 'not_found' })) })));
    await syncPending(1);
    expect(toast.current).toBeNull();
    expect(invalidateAll).toHaveBeenCalled();
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['q']);
  });
});

describe('retryQuarantined', () => {
  it('serveur OK → geste appliqué, quarantinedItems vide', async () => {
    await seedQuarantined(consume('a'));
    await enqueue(1, review('r', 'a'));
    await refreshPending(1);
    const s = server(applied);
    await retryQuarantined(1, 'a');
    expect(s.batches.map((b) => b.map((o) => o.opId))).toEqual([['a'], ['r']]); // sent alone, then its review
    expect(await listQueued(1)).toEqual([]);
    expect(quarantinedItems()).toEqual([]);
    expect(pendingCount()).toBe(0);
    expect(invalidateAll).toHaveBeenCalled();
    expect(toast.current).toBeNull();
  });

  it('nouveau 500 (serveur joignable) → de nouveau en quarantaine, toast quarantine_still_failing', async () => {
    await seedQuarantined(consume('a'));
    await enqueue(1, review('r', 'a'));
    await refreshPending(1);
    const s = server(fail500);
    await retryQuarantined(1, 'a');
    expect(s.batches.map((b) => b.map((o) => o.opId))).toEqual([['a']]); // the review stays held
    expect(quarantinedIds()).toEqual(['a']);
    expect(quarantinedItems()[0].held.map((h) => h.op.opId)).toEqual(['r']);
    expect(pendingCount()).toBe(0);
    expect(toast.current?.message).toBe(m.quarantine_still_failing());
    const [row] = (await listQueued(1)).filter((q) => q.op.opId === 'a');
    expect(row.strikes).toBe(MAX_STRIKES);
  });

  it('hors ligne → geste de nouveau en attente (pendingCount 1), pas en quarantaine', async () => {
    await seedQuarantined(consume('a'));
    await refreshPending(1);
    offline();
    await retryQuarantined(1, 'a');
    expect(pendingCount()).toBe(1);
    expect(pendingOps().map((o) => o.opId)).toEqual(['a']);
    expect(quarantinedItems()).toEqual([]);
    const [row] = await listQueued(1);
    expect(row.quarantinedAt).toBeUndefined();
    expect(row.strikes).toBe(MAX_STRIKES - 1); // no strike without the server
    expect(toast.current).toBeNull();
  });
});

describe('abandonQuarantined', () => {
  it('ligne et review retenu supprimés, invalidateAll appelé, toast quarantine_abandoned', async () => {
    await seedQuarantined(consume('a'));
    await enqueue(1, review('r', 'a'));
    await enqueue(1, consume('b'));
    await refreshPending(1);
    offline();
    await abandonQuarantined(1, 'a');
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['b']);
    expect(quarantinedItems()).toEqual([]);
    expect(pendingOps().map((o) => o.opId)).toEqual(['b']);
    expect(invalidateAll).toHaveBeenCalled();
    expect(toast.current?.message).toBe(m.quarantine_abandoned());
  });

  it('sur une ligne undo → aucun inverse en file', async () => {
    await seedQuarantined(consume('a'));
    await markUndo('a');
    await refreshPending(1);
    expect(quarantinedIds()).toEqual(['a']);
    const s = server(applied);
    await abandonQuarantined(1, 'a');
    expect(await listQueued(1)).toEqual([]);
    expect(s.fetch).not.toHaveBeenCalled();
  });
});

describe('message sync-outcome du service worker', () => {
  it('message sync-outcome sans quarantined → accepté', async () => {
    const sw = Object.assign(new EventTarget(), { ready: new Promise<never>(() => {}) });
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: sw });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    const s = server(applied);
    const stop = startSyncLoop(1); // empty queue: no sync of its own, no reload
    try {
      // The service worker (an older version, without `quarantined`) sent a gesture made elsewhere.
      sw.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'sync-outcome',
            userId: 1,
            outcome: { sent: 1, results: [{ opId: 'a', status: 'applied' }], dropped: [], status: 'ok' }
          }
        })
      );
      await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled()); // handled: the data is reloaded
      expect(s.fetch).not.toHaveBeenCalled();
      expect(toast.current).toBeNull();
      expect(quarantinedItems()).toEqual([]);
    } finally {
      stop();
    }
  });
});
