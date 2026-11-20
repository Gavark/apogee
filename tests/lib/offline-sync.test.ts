import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueue, listQueued, _resetForTests } from '$lib/offline/queue';
import { syncNow } from '$lib/offline/sync';
import type { OpResult, StockOp } from '$lib/server/stock';

const adj = (opId: string, delta = 1): StockOp => ({ opId, kind: 'adjust', lotId: 1, delta });
const consume = (opId: string): StockOp => ({ opId, kind: 'consume', lotId: 7, consumedOn: '2026-11-20' });

type Sent = StockOp[];

/** A fake /api/stock/ops: records each batch and answers with `answer(batch)`. */
function server(answer: (ops: StockOp[]) => Response | Promise<Response>) {
  const batches: Sent[] = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { ops } = JSON.parse(String(init?.body)) as { ops: StockOp[] };
    batches.push(ops);
    return answer(ops);
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, batches, calls: fetch };
}

const ok = (results: OpResult[]) => new Response(JSON.stringify({ results }));
const allApplied = (ops: StockOp[]) => ok(ops.map((o) => ({ opId: o.opId, status: 'applied' as const })));

beforeEach(() => {
  _resetForTests();
  globalThis.indexedDB = new IDBFactory();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('syncNow', () => {
  it('file vide → idle, aucun envoi', async () => {
    const s = server(allApplied);
    await expect(syncNow(1, { fetch: s.fetch })).resolves.toMatchObject({ status: 'idle', sent: 0 });
    expect(s.calls).not.toHaveBeenCalled();
  });

  it('2xx → envoie dans l’ordre, renvoie les résultats et vide la file', async () => {
    await enqueue(1, adj('c'));
    await enqueue(1, adj('a'));
    await enqueue(2, adj('other-user'));
    await enqueue(1, adj('b'));
    const s = server(allApplied);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('ok');
    expect(out.sent).toBe(3);
    expect(s.batches.map((b) => b.map((o) => o.opId))).toEqual([['c', 'a', 'b']]);
    expect(out.results.map((r) => r.opId)).toEqual(['c', 'a', 'b']);
    expect(await listQueued(1)).toEqual([]);
    expect((await listQueued(2)).map((q) => q.op.opId)).toEqual(['other-user']);
  });

  it('double appui hors ligne (deux opId) → au retour : applied puis rejected empty_lot', async () => {
    await enqueue(1, consume('tap-1'));
    await enqueue(1, consume('tap-2'));
    let stock = 1;
    const s = server((ops) =>
      ok(
        ops.map((o) =>
          stock-- > 0
            ? { opId: o.opId, status: 'applied' as const, consumptionId: 42 }
            : { opId: o.opId, status: 'rejected' as const, reason: 'empty_lot' as const }
        )
      )
    );
    const out = await syncNow(1, { fetch: s.fetch });
    expect(s.calls).toHaveBeenCalledTimes(1);
    expect(out.results).toEqual([
      { opId: 'tap-1', status: 'applied', consumptionId: 42 },
      { opId: 'tap-2', status: 'rejected', reason: 'empty_lot' }
    ]);
    expect(await listQueued(1)).toEqual([]);
  });

  it('400 → les opérations sont retirées et renvoyées dans dropped', async () => {
    await enqueue(1, adj('bad'));
    const s = server(() => new Response('{"error":"invalid"}', { status: 400 }));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.dropped.map((o) => o.opId)).toEqual(['bad']);
    expect(out.results).toEqual([]);
    expect(await listQueued(1)).toEqual([]);
  });

  it('401 → unauthorized, file conservée telle quelle', async () => {
    await enqueue(1, adj('a'));
    const s = server(() => new Response('{}', { status: 401 }));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('unauthorized');
    const q = await listQueued(1);
    expect(q.map((x) => x.op.opId)).toEqual(['a']);
    expect(q[0].attempts).toBe(0);
  });

  it('envoie l’utilisateur attendu dans x-apogee-user', async () => {
    await enqueue(7, adj('a'));
    const s = server(allApplied);
    await syncNow(7, { fetch: s.fetch });
    const init = s.calls.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('x-apogee-user')).toBe('7');
  });

  it('utilisateur différent de la session (409) → unauthorized, file conservée, aucune tentative comptée', async () => {
    await enqueue(1, adj('a'));
    await enqueue(1, consume('b'));
    const s = server(() => new Response(JSON.stringify({ error: 'user_mismatch' }), { status: 409 }));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out).toMatchObject({ status: 'unauthorized', sent: 0, results: [], dropped: [] });
    const q = await listQueued(1);
    expect(q.map((x) => x.op.opId)).toEqual(['a', 'b']);
    expect(q.map((x) => x.attempts)).toEqual([0, 0]);
  });

  it('500 → retry et attempts incrémenté', async () => {
    await enqueue(1, adj('a'));
    const s = server(() => new Response('{}', { status: 500 }));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    const q = await listQueued(1);
    expect(q.map((x) => x.op.opId)).toEqual(['a']);
    expect(q[0].attempts).toBe(1);
  });

  it('erreur réseau → retry et attempts incrémenté', async () => {
    await enqueue(1, adj('a'));
    const s = server(() => {
      throw new TypeError('Failed to fetch');
    });
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    expect((await listQueued(1))[0].attempts).toBe(1);
  });

  it('navigateur hors ligne → offline, aucun envoi ni tentative comptée', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await enqueue(1, adj('a'));
    const s = server(allApplied);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('offline');
    expect(s.calls).not.toHaveBeenCalled();
    expect((await listQueued(1))[0].attempts).toBe(0);
  });

  it('deux syncNow en même temps → un seul fetch, l’autre busy', async () => {
    await enqueue(1, adj('a'));
    const s = server(allApplied);
    const [x, y] = await Promise.all([syncNow(1, { fetch: s.fetch }), syncNow(1, { fetch: s.fetch })]);
    expect(s.calls).toHaveBeenCalledTimes(1);
    expect([x.status, y.status].sort()).toEqual(['busy', 'ok']);
    // Once the first one is done, a new call runs normally.
    await expect(syncNow(1, { fetch: s.fetch })).resolves.toMatchObject({ status: 'idle' });
  });

  it('prend le verrou navigator.locks « apogee-sync » quand il existe ; verrou pris ailleurs → busy', async () => {
    let held = false;
    const request = vi.fn(async (name: string, opts: { ifAvailable?: boolean }, cb: (lock: unknown) => unknown) => {
      if (held && opts.ifAvailable) return cb(null);
      held = true;
      try {
        return await cb({ name });
      } finally {
        held = false;
      }
    });
    vi.stubGlobal('navigator', { onLine: true, locks: { request } });
    await enqueue(1, adj('a'));
    const s = server(allApplied);
    await expect(syncNow(1, { fetch: s.fetch })).resolves.toMatchObject({ status: 'ok' });
    expect(request.mock.calls[0][0]).toBe('apogee-sync');

    // Another context (the service worker) holds the lock.
    await enqueue(1, adj('b'));
    held = true;
    await expect(syncNow(1, { fetch: s.fetch })).resolves.toMatchObject({ status: 'busy' });
    expect(s.calls).toHaveBeenCalledTimes(1);
  });

  it('plus de 100 opérations → plusieurs lots, dans l’ordre', async () => {
    for (let i = 0; i < 150; i++) await enqueue(1, adj(`op-${String(i).padStart(3, '0')}`));
    const s = server(allApplied);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(s.batches.map((b) => b.length)).toEqual([100, 50]);
    expect(s.batches.flat().map((o) => o.opId)).toEqual(
      Array.from({ length: 150 }, (_, i) => `op-${String(i).padStart(3, '0')}`)
    );
    expect(out.sent).toBe(150);
    expect(await listQueued(1)).toEqual([]);
  });

  it('échec au deuxième lot → le premier est retiré, le second reste en file', async () => {
    for (let i = 0; i < 101; i++) await enqueue(1, adj(`op-${String(i).padStart(3, '0')}`));
    let n = 0;
    const s = server((ops) => (n++ === 0 ? allApplied(ops) : new Response('{}', { status: 503 })));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    expect(out.sent).toBe(100);
    const q = await listQueued(1);
    expect(q.map((x) => x.op.opId)).toEqual(['op-100']);
    expect(q[0].attempts).toBe(1);
  });
});
