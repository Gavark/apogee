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

import { sendStockOps, SessionExpiredError, undoGesture, undoStockOp } from '../../src/lib/stock-client';
import { listQueued, removeQueued, _resetForTests } from '$lib/offline/queue';
import { pendingCount, pendingOps, refreshPending, startSyncLoop, syncPending, trackOps, usePendingFor, _resetPendingForTests } from '$lib/offline/pending.svelte';
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
/** The browser knows it is offline: nothing is even attempted (attempts stay at 0). */
const knownOffline = () => {
  vi.stubGlobal('navigator', { onLine: false });
  const fetch = vi.fn(async () => new Response('{}', { status: 599 }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
};
const backOnline = () => vi.stubGlobal('navigator', { onLine: true });

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

  it('sans utilisateur connu : pas d’en-tête x-apogee-user', async () => {
    const f = vi.fn(async (_u: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ results: [] })));
    vi.stubGlobal('fetch', f);
    await sendStockOps([op]);
    expect(new Headers(f.mock.calls[0][1]?.headers).has('x-apogee-user')).toBe(false);
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

  it('envoie l’utilisateur attendu dans x-apogee-user', async () => {
    const { fetch } = serve();
    await sendStockOps([op]);
    expect(new Headers((fetch.mock.calls[0][1] as RequestInit).headers).get('x-apogee-user')).toBe('1');
  });

  it('autre compte dans la session (409) → /login et SessionExpiredError, l’opération reste en file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'user_mismatch' }), { status: 409 })));
    await expect(sendStockOps([op])).rejects.toBeInstanceOf(SessionExpiredError);
    expect(goto).toHaveBeenCalledWith('/login');
    const q = await listQueued(1);
    expect(q.map((x) => x.op.opId)).toEqual([op.opId]);
    expect(q[0].attempts).toBe(0);
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

  it('verdict rejeté not_found (« Bue » annulé entre-temps) → file vidée, aucun message d’échec', async () => {
    offline();
    const review: StockOp = { opId: 'rv-1', kind: 'review', consumeOpId: 'gone', verdict: 'late', note: null };
    await sendStockOps([review]);
    serve((o) => ({ opId: o.opId, status: 'rejected', reason: 'not_found' }));
    await syncPending(1);
    expect(toast.current).toBeNull();
    expect(invalidateAll).toHaveBeenCalled();
    expect(await listQueued(1)).toEqual([]);
    expect(pendingOps()).toEqual([]);
  });

  it('en contrôle : un « Bue » rejeté not_found reste signalé', async () => {
    offline();
    await sendStockOps([consume('c-1')]);
    serve((o) => ({ opId: o.opId, status: 'rejected', reason: 'not_found' }));
    await syncPending(1);
    expect(toast.current?.message).toBe(m.offline_op_failed());
    expect(await listQueued(1)).toEqual([]);
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

  it('geste jamais tenté → retiré de la file, rien n’est envoyé', async () => {
    const f = knownOffline();
    const g = consume('a');
    await sendStockOps([g]);
    expect(f).not.toHaveBeenCalled();
    backOnline();
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

  it('après un 500 (peut-être appliqué) → rejoue le geste puis envoie l’inverse', async () => {
    const g = consume('a');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    await expect(sendStockOps([g])).resolves.toEqual([{ opId: 'a', status: 'queued' }]);
    expect((await listQueued(1))[0].attempts).toBe(1);
    // The server committed it before failing: the replay returns the stored result.
    const s = serve((o) => (o.kind === 'consume' ? { opId: o.opId, status: 'applied', consumptionId: 77 } : { opId: o.opId, status: 'applied' }));
    await expect(undoStockOp(g)).resolves.toMatchObject({ status: 'applied' });
    expect(s.batches.map((b) => b.map((o) => o.kind))).toEqual([['consume'], ['unconsume']]);
    expect(s.batches[0][0].opId).toBe('a');
    expect(s.batches[1][0]).toMatchObject({ kind: 'unconsume', consumptionId: 77 });
    expect(await listQueued(1)).toEqual([]);
    // The replay and the inverse both name the expected user.
    for (const [, init] of s.fetch.mock.calls) expect(new Headers((init as RequestInit).headers).get('x-apogee-user')).toBe('1');
  });

  it('rejeu sous un autre compte (409) → /login et SessionExpiredError, le geste reste en file', async () => {
    const g = consume('a');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    await sendStockOps([g]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'user_mismatch' }), { status: 409 })));
    await expect(undoStockOp(g)).rejects.toBeInstanceOf(SessionExpiredError);
    expect(goto).toHaveBeenCalledWith('/login');
    expect((await listQueued(1)).map((x) => x.op.opId)).toEqual(['a']);
  });

  it('après une réponse perdue (délai dépassé) → rejoue le geste puis envoie l’inverse', async () => {
    const g: StockOp = { opId: 'a', kind: 'adjust', lotId: 3, delta: -1 };
    const committed: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: unknown, init?: RequestInit) => {
        committed.push(...(JSON.parse(String(init?.body)) as { ops: StockOp[] }).ops.map((o) => o.opId));
        throw new DOMException('The operation timed out.', 'TimeoutError');
      })
    );
    await expect(sendStockOps([g])).resolves.toEqual([{ opId: 'a', status: 'queued' }]);
    expect(committed).toEqual(['a']);
    const s = serve((o) => ({ opId: o.opId, status: 'applied', appliedQuantity: o.kind === 'adjust' ? o.delta : undefined }));
    await undoStockOp(g);
    expect(s.batches).toEqual([[g], [expect.objectContaining({ kind: 'adjust', lotId: 3, delta: 1 })]]);
    expect(await listQueued(1)).toEqual([]);
  });

  it('peut-être appliqué et toujours hors ligne → annulation différée, appliquée à la synchronisation', async () => {
    const g = consume('a');
    offline();
    await sendStockOps([g]); // attempted: attempts = 1
    await expect(undoStockOp(g)).resolves.toBe('deferred');
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['a']); // kept: maybe applied
    expect(pendingOps()).toEqual([]); // but no longer shown
    const s = serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: o.kind === 'consume' ? 8 : undefined }));
    await syncPending(1);
    expect(s.batches.map((b) => b.map((o) => o.kind))).toEqual([['consume'], ['unconsume']]);
    expect(s.batches[1][0]).toMatchObject({ consumptionId: 8 });
    expect(await listQueued(1)).toEqual([]);
    expect(pendingCount()).toBe(0);
    expect(toast.current).toBeNull(); // no warning for the undo itself
    expect(invalidateAll).toHaveBeenCalled();
  });

  it('geste jamais vu dans cet onglet → rien n’est envoyé', async () => {
    const s = serve();
    await expect(undoStockOp(consume('never-seen'))).resolves.toBeNull();
    expect(s.fetch).not.toHaveBeenCalled();
  });

  it('geste d’ici synchronisé par un autre contexte (résultat inconnu ici) → rejoué pour connaître son résultat, puis inverse', async () => {
    const g = consume('a');
    offline();
    await sendStockOps([g]);
    await removeQueued(['a']); // another context synced it: this tab never saw the result
    const s = serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: o.kind === 'consume' ? 3 : undefined }));
    await expect(undoStockOp(g)).resolves.toMatchObject({ status: 'applied' });
    expect(s.batches.map((b) => b.map((o) => o.kind))).toEqual([['consume'], ['unconsume']]);
    expect(s.batches[0][0].opId).toBe('a');
    expect(s.batches[1][0]).toMatchObject({ consumptionId: 3 });
  });

  it('rejeu sans réseau → échec réseau signalé, pas de silence', async () => {
    const g = consume('a');
    offline();
    await sendStockOps([g]);
    await removeQueued(['a']);
    await undoGesture(g);
    expect(toast.current?.message).toBe(m.wine_err_network());
  });

  it('rien à annuler (aucun résultat connu) → message d’échec, pas de silence', async () => {
    serve();
    await undoGesture(consume('never-seen'));
    expect(toast.current?.message).toBe(m.wine_err_op());
  });
});

describe('synchronisation par un autre contexte', () => {
  beforeEach(() => (page.data = { user: { id: 1 } }));

  it('gestes envoyés ailleurs (autre onglet, service worker) → données rechargées, surcouche retirée ensuite', async () => {
    offline();
    await sendStockOps([consume('a')]);
    await removeQueued(['a']); // another context synced it
    const s = serve();
    await syncPending(1);
    expect(s.fetch).not.toHaveBeenCalled();
    expect(invalidateAll).toHaveBeenCalled();
    expect(pendingOps()).toEqual([]);
    expect(pendingCount()).toBe(0);
  });

  it('geste annulé (différé) puis envoyé ailleurs → l’autre contexte envoie aussi l’inverse ; rien n’est renvoyé d’ici', async () => {
    const g = consume('a');
    offline();
    await sendStockOps([g]);
    await expect(undoStockOp(g)).resolves.toBe('deferred');
    // Another context (the service worker, with its own modules) syncs the queue.
    vi.resetModules();
    const elsewhere = await import('$lib/offline/sync');
    const other = serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: o.kind === 'consume' ? 3 : undefined }));
    await elsewhere.syncNow(1, { fetch: other.fetch as unknown as typeof fetch });
    expect(other.batches.map((b) => b.map((o) => o.kind))).toEqual([['consume'], ['unconsume']]);
    expect(other.batches[1][0]).toMatchObject({ consumptionId: 3 });

    const s = serve();
    invalidateAll.mockClear();
    await syncPending(1);
    expect(s.fetch).not.toHaveBeenCalled(); // neither replayed nor undone twice
    expect(await listQueued(1)).toEqual([]);
    expect(invalidateAll).toHaveBeenCalled();
    expect(pendingOps()).toEqual([]);
  });

  it('annulation différée puis appli fermée avant le retour du réseau → l’inverse part quand même à la réouverture', async () => {
    const g = consume('a');
    offline();
    await sendStockOps([g]); // attempted: maybe applied
    await expect(undoStockOp(g)).resolves.toBe('deferred');
    _resetPendingForTests(); // the app is closed: nothing left in memory
    knownOffline();
    usePendingFor(1); // reopened (startSyncLoop), still offline
    await refreshPending(1);
    expect(pendingOps()).toEqual([]); // still not shown
    expect(pendingCount()).toBe(1); // but still waiting to be sent
    backOnline();
    const s = serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: o.kind === 'consume' ? 6 : undefined }));
    await syncPending(1);
    expect(s.batches.map((b) => b.map((o) => o.kind))).toEqual([['consume'], ['unconsume']]);
    expect(s.batches[1][0]).toMatchObject({ consumptionId: 6 });
    expect(await listQueued(1)).toEqual([]);
    expect(toast.current).toBeNull(); // the undo is no news
  });

  it('un geste pas encore écrit dans la file n’est pas pris pour envoyé ailleurs', async () => {
    knownOffline();
    trackOps([consume('a')]); // what sendStockOps does before the IndexedDB write completes
    await syncPending(1);
    expect(pendingOps().map((o) => o.opId)).toEqual(['a']);
    expect(invalidateAll).not.toHaveBeenCalled();
  });
});

describe('changement d’utilisateur dans le même onglet', () => {
  it('A a une annulation différée, puis B se connecte → rien de A n’est envoyé, pas de boucle, rien en attente pour B', async () => {
    page.data = { user: { id: 1 } };
    const g = consume('a');
    offline();
    await sendStockOps([g]);
    await expect(undoStockOp(g)).resolves.toBe('deferred');

    page.data = { user: { id: 2 } };
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    const s = serve();
    invalidateAll.mockClear();
    const stop = startSyncLoop(2);
    try {
      await vi.waitFor(() => expect(pendingCount()).toBe(0));
      await syncPending(2); // must settle: no endless replay chain
      expect(s.fetch).not.toHaveBeenCalled();
      expect(invalidateAll.mock.calls.length).toBeLessThanOrEqual(1);
      expect(pendingOps()).toEqual([]);
      const q = await listQueued(1);
      expect(q).toHaveLength(1);
      expect(q[0]).toMatchObject({ userId: 1, attempts: 1, op: { opId: 'a' } });
      expect(await listQueued(2)).toEqual([]);
    } finally {
      stop();
    }
  });

  it('un geste de A envoyé ailleurs n’est jamais remis en file sous B', async () => {
    page.data = { user: { id: 1 } };
    const g = consume('a');
    offline();
    await sendStockOps([g]);
    await expect(undoStockOp(g)).resolves.toBe('deferred');
    await removeQueued(['a']); // A's row gone
    page.data = { user: { id: 2 } };
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    const s = serve();
    const stop = startSyncLoop(2);
    try {
      await syncPending(2);
      await syncPending(2);
      expect(s.fetch).not.toHaveBeenCalled();
      expect(await listQueued(2)).toEqual([]);
      expect(pendingCount()).toBe(0);
    } finally {
      stop();
    }
  });

  it('les résultats de A ne servent pas à annuler sous B', async () => {
    page.data = { user: { id: 1 } };
    const g = consume('a');
    serve((o) => ({ opId: o.opId, status: 'applied', consumptionId: 5 }));
    await sendStockOps([g]); // applied for A, result known
    page.data = { user: { id: 2 } };
    const s = serve();
    await expect(undoStockOp(g)).resolves.toBeNull();
    expect(s.fetch).not.toHaveBeenCalled();
  });

  it('gestes en attente de A : invisibles pour B, sans rechargement', async () => {
    page.data = { user: { id: 1 } };
    offline();
    await sendStockOps([consume('a')]);
    page.data = { user: { id: 2 } };
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    invalidateAll.mockClear();
    const stop = startSyncLoop(2);
    try {
      expect(pendingOps()).toEqual([]);
      await syncPending(2);
      await syncPending(2);
      expect(pendingOps()).toEqual([]);
      expect(invalidateAll).not.toHaveBeenCalled();
    } finally {
      stop();
    }
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['a']);
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
