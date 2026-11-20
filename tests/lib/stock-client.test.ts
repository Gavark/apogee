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

import { sendStockOps, SessionExpiredError, undoStockOp } from '../../src/lib/stock-client';
import { listQueued, _resetForTests } from '$lib/offline/queue';
import { pendingCount, pendingOps, startSyncLoop, syncPending, _resetPendingForTests } from '$lib/offline/pending.svelte';
import { dismissToast, toast } from '$lib/toast.svelte';
import * as m from '$paraglide/messages';
import type { OpResult, StockOp } from '$lib/server/stock';

const op = { opId: '11111111-1111-4111-8111-111111111111', kind: 'adjust', lotId: 1, delta: 1 } as const;
const consume = (opId: string): StockOp => ({ opId, kind: 'consume', lotId: 7, consumedOn: '2026-11-20' });

/** A fake /api/stock/ops answering each op with `answer(op)`; records the batches it received. */
function serve(answer: (o: StockOp) => OpResult = (o) => ({ opId: o.opId, status: 'applied' })) {
  const batches: StockOp[][] = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { ops } = JSON.parse(String(init?.body)) as { ops: StockOp[] };
    batches.push(ops);
    return new Response(JSON.stringify({ results: ops.map(answer) }));
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, batches };
}
const offline = () => vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));

beforeEach(() => {
  goto.mockClear();
  invalidateAll.mockClear();
  _resetForTests();
  globalThis.indexedDB = new IDBFactory();
  _resetPendingForTests();
  dismissToast();
});
afterEach(() => vi.unstubAllGlobals());

describe('sendStockOps sans utilisateur connu (envoi direct)', () => {
  beforeEach(() => (page.data = {}));

  it('renvoie les résultats sur 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ results: [{ opId: op.opId, status: 'applied' }] }))));
    await expect(sendStockOps([op])).resolves.toEqual([{ opId: op.opId, status: 'applied' }]);
    expect(goto).not.toHaveBeenCalled();
  });

  it('sur 401 : redirige vers /login et lève SessionExpiredError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await expect(sendStockOps([op])).rejects.toBeInstanceOf(SessionExpiredError);
    expect(goto).toHaveBeenCalledWith('/login');
  });

  it('sur une autre erreur HTTP : échec simple, pas de redirection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    const err = await sendStockOps([op]).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SessionExpiredError);
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('sendStockOps via la file', () => {
  beforeEach(() => (page.data = { user: { id: 1 } }));

  it('en ligne → résultats applied et file vide', async () => {
    const s = serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: 9 }));
    await expect(sendStockOps([consume('a')])).resolves.toEqual([{ opId: 'a', status: 'applied', consumptionId: 9 }]);
    expect(s.fetch).toHaveBeenCalledTimes(1);
    expect(await listQueued(1)).toEqual([]);
    expect(pendingCount()).toBe(0);
  });

  it('résultats rejected / partial transmis tels quels à l’appelant (sans toast d’avertissement)', async () => {
    serve((o) => ({ opId: o.opId, status: 'rejected', reason: 'empty_lot' }));
    await expect(sendStockOps([consume('a')])).resolves.toEqual([{ opId: 'a', status: 'rejected', reason: 'empty_lot' }]);
    await syncPending(1); // lets the sync's follow-up run
    expect(toast.current).toBeNull(); // the caller shows its own message…
    expect(invalidateAll).not.toHaveBeenCalled(); // …and reloads itself
    expect(pendingOps()).toEqual([]);
  });

  it('hors ligne → queued, un élément en file, effet visible dans pendingOps, aucune exception', async () => {
    offline();
    await expect(sendStockOps([consume('a')])).resolves.toEqual([{ opId: 'a', status: 'queued' }]);
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['a']);
    expect(pendingOps().map((o) => o.opId)).toEqual(['a']);
    expect(pendingCount()).toBe(1);
    expect(goto).not.toHaveBeenCalled();
  });

  it('même opId envoyé deux fois hors ligne → une seule entrée', async () => {
    offline();
    await sendStockOps([consume('a')]);
    await sendStockOps([consume('a')]);
    expect(await listQueued(1)).toHaveLength(1);
    expect(pendingOps()).toHaveLength(1);
  });

  it('401 → /login et SessionExpiredError, l’opération reste en file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await expect(sendStockOps([op])).rejects.toBeInstanceOf(SessionExpiredError);
    expect(goto).toHaveBeenCalledWith('/login');
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual([op.opId]);
  });

  it('double appui « Bue » hors ligne → au retour : applied puis rejected empty_lot, signalé puis rechargé', async () => {
    offline();
    await sendStockOps([consume('tap-1')]);
    await sendStockOps([consume('tap-2')]);
    expect(pendingCount()).toBe(2);
    let stock = 1;
    const s = serve((o) =>
      stock-- > 0 ? { opId: o.opId, status: 'applied', consumptionId: 5 } : { opId: o.opId, status: 'rejected', reason: 'empty_lot' }
    );
    const out = await syncPending(1);
    expect(s.batches.map((b) => b.map((o) => o.opId))).toEqual([['tap-1', 'tap-2']]);
    expect(out.results.map((r) => r.status)).toEqual(['applied', 'rejected']);
    expect(toast.current?.message).toBe(m.drink_empty_lot());
    expect(invalidateAll).toHaveBeenCalled();
    expect(pendingOps()).toEqual([]); // applied one cleared by the reload, rejected one at once
  });

  it('opération refusée par le serveur (400) → retirée et signalée', async () => {
    offline();
    await sendStockOps([op]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })));
    const out = await syncPending(1);
    expect(out.dropped.map((o) => o.opId)).toEqual([op.opId]);
    expect(toast.current?.message).toBe(m.offline_op_failed());
    expect(await listQueued(1)).toEqual([]);
    expect(pendingOps()).toEqual([]);
  });
});

describe('undoStockOp', () => {
  beforeEach(() => (page.data = { user: { id: 1 } }));

  it('geste encore en file → retiré, rien n’est envoyé', async () => {
    offline();
    const g = consume('a');
    await sendStockOps([g]);
    const s = serve();
    await expect(undoStockOp(g)).resolves.toBe('unqueued');
    expect(await listQueued(1)).toEqual([]);
    expect(pendingOps()).toEqual([]);
    await syncPending(1);
    expect(s.fetch).not.toHaveBeenCalled();
  });

  it('« Bue » hors ligne synchronisé ensuite → annulation = unconsume avec le consumptionId obtenu', async () => {
    offline();
    const g = consume('a');
    await sendStockOps([g]);
    serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: 42 }));
    await syncPending(1);
    const s = serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: 42 }));
    await expect(undoStockOp(g)).resolves.toMatchObject({ status: 'applied' });
    expect(s.batches).toHaveLength(1);
    expect(s.batches[0]).toEqual([expect.objectContaining({ kind: 'unconsume', consumptionId: 42 })]);
  });

  it('retrait (-1) synchronisé → annulation = ajustement inverse de la quantité réellement retirée', async () => {
    const g: StockOp = { opId: 'a', kind: 'adjust', lotId: 3, delta: -1 };
    serve((o) => ({ opId: o.opId, status: 'applied', appliedQuantity: -1 }));
    await sendStockOps([g]);
    const s = serve();
    await undoStockOp(g);
    expect(s.batches[0]).toEqual([expect.objectContaining({ kind: 'adjust', lotId: 3, delta: 1 })]);
  });

  it('résultat inconnu → rien n’est envoyé', async () => {
    const s = serve();
    await expect(undoStockOp(consume('never-seen'))).resolves.toBeNull();
    expect(s.fetch).not.toHaveBeenCalled();
  });
});

describe('startSyncLoop', () => {
  beforeEach(() => (page.data = { user: { id: 1 } }));

  it('synchronise au retour du réseau (online)', async () => {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    offline();
    await sendStockOps([consume('a')]);
    const s = serve();
    const stop = startSyncLoop(1);
    try {
      await vi.waitFor(() => expect(s.fetch).toHaveBeenCalledTimes(1)); // pending ops found at start
      offline();
      await sendStockOps([consume('b')]);
      const s2 = serve();
      win.dispatchEvent(new Event('online'));
      await vi.waitFor(() => expect(s2.fetch).toHaveBeenCalledTimes(1));
      expect(await listQueued(1)).toEqual([]);
    } finally {
      stop();
    }
  });
});
