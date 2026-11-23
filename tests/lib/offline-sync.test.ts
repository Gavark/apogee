import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bumpAttempts, enqueue, getLastSentAt, listQueued, markUndo, quarantine, strike, _resetForTests } from '$lib/offline/queue';
import { MAX_STRIKES, postOps, serverReachable, syncNow } from '$lib/offline/sync';
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

describe('annulation différée (geste marqué undo dans la file)', () => {
  /** Answers like the server: consume → consumptionId 42, adjust → its delta, unconsume → applied. */
  const realistic = (ops: StockOp[]) =>
    ok(
      ops.map((o): OpResult => {
        if (o.kind === 'consume') return { opId: o.opId, status: 'applied', consumptionId: 42 };
        if (o.kind === 'adjust') return { opId: o.opId, status: 'applied', appliedQuantity: o.delta };
        return { opId: o.opId, status: 'applied' };
      })
    );

  it('markUndo marque la ligne (false si le geste n’est plus en file)', async () => {
    await enqueue(1, consume('a'));
    await expect(markUndo('a')).resolves.toBe(true);
    await expect(markUndo('absent')).resolves.toBe(false);
    expect((await listQueued(1))[0]).toMatchObject({ op: { opId: 'a' }, undo: true });
  });

  it('résultat connu → l’inverse (unconsume du consumptionId obtenu) est mis en file et envoyé dans la même synchronisation', async () => {
    await enqueue(1, consume('a'));
    await markUndo('a');
    const s = server(realistic);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('ok');
    expect(s.batches.map((b) => b.map((o) => o.kind))).toEqual([['consume'], ['unconsume']]);
    expect(s.batches[1][0]).toMatchObject({ kind: 'unconsume', consumptionId: 42 });
    expect(out.undone).toEqual(['a', s.batches[1][0].opId]);
    expect(out.results.map((r) => r.opId)).toEqual(['a', s.batches[1][0].opId]);
    expect(await listQueued(1)).toEqual([]);
  });

  it('l’inverse reste en file si son envoi échoue, et part à la synchronisation suivante', async () => {
    await enqueue(1, consume('a'));
    await markUndo('a');
    let n = 0;
    const s = server((ops) => (n++ === 0 ? realistic(ops) : new Response('{}', { status: 503 })));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    const q = await listQueued(1);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ op: { kind: 'unconsume', consumptionId: 42 }, inverseOf: 'a', attempts: 1 });
    expect(q[0].undo).toBeUndefined();

    const s2 = server(realistic);
    const again = await syncNow(1, { fetch: s2.fetch });
    expect(s2.batches).toEqual([[q[0].op]]);
    expect(again.undone).toEqual([q[0].op.opId]); // still an undo: no news for the user
    expect(await listQueued(1)).toEqual([]);
  });

  it('ajustement → inverse de la quantité réellement appliquée', async () => {
    await enqueue(1, { opId: 'a', kind: 'adjust', lotId: 3, delta: -2 });
    await markUndo('a');
    const s = server((ops) =>
      ok(ops.map((o) => ({ opId: o.opId, status: 'partial' as const, appliedQuantity: o.kind === 'adjust' && o.lotId === 3 && o.delta < 0 ? -1 : 1 })))
    );
    await syncNow(1, { fetch: s.fetch });
    expect(s.batches[1]).toEqual([expect.objectContaining({ kind: 'adjust', lotId: 3, delta: 1 })]);
  });

  it('geste refusé (rejected) ou rejeté (400) → aucun inverse', async () => {
    await enqueue(1, consume('a'));
    await markUndo('a');
    const s = server((ops) => ok(ops.map((o) => ({ opId: o.opId, status: 'rejected' as const, reason: 'empty_lot' as const }))));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(s.batches).toHaveLength(1);
    expect(out.undone).toEqual(['a']);
    expect(await listQueued(1)).toEqual([]);

    await enqueue(1, consume('b'));
    await markUndo('b');
    const s400 = server(() => new Response('{"error":"invalid"}', { status: 400 }));
    const dropped = await syncNow(1, { fetch: s400.fetch });
    expect(s400.batches).toHaveLength(1);
    expect(dropped.undone).toEqual(['b']);
    expect(await listQueued(1)).toEqual([]);
  });

  it('le marquage survit à la fermeture de l’appli (nouvel état des modules) : l’inverse part quand même', async () => {
    await enqueue(1, consume('a'));
    await markUndo('a');
    // App closed, then reopened (or the service worker wakes up): fresh modules, same IndexedDB.
    _resetForTests();
    vi.resetModules();
    const fresh = await import('$lib/offline/sync');
    const s = server(realistic);
    await fresh.syncNow(1, { fetch: s.fetch });
    expect(s.batches.map((b) => b.map((o) => o.kind))).toEqual([['consume'], ['unconsume']]);
    expect(s.batches[1][0]).toMatchObject({ consumptionId: 42 });
  });
});

/**
 * Like `server`, plus GET /healthz: `health.up` true answers 200, a number answers with that status,
 * false rejects (server unreachable). `health.probes` counts the /healthz calls.
 */
function serverWithHealth(answer: (ops: StockOp[]) => Response | Promise<Response>, up: boolean | number = true) {
  const batches: Sent[] = [];
  const health = { up, probes: 0 };
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === '/healthz') {
      health.probes++;
      if (typeof health.up === 'number') return new Response('', { status: health.up });
      if (health.up) return new Response('ok');
      throw new TypeError('Failed to fetch');
    }
    const { ops } = JSON.parse(String(init?.body)) as { ops: StockOp[] };
    batches.push(ops);
    return answer(ops);
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, batches, calls: fetch, health };
}

const ids = (batches: Sent[]) => batches.map((b) => b.map((o) => o.opId));
const status500 = () => new Response('{}', { status: 500 });
const review = (opId: string, consumeOpId: string): StockOp => ({ opId, kind: 'review', consumeOpId, verdict: 'right', note: null });
/** Answers 500 to any batch holding `culprit`, applies the others. */
const failsOn = (culprit: string) => (ops: StockOp[]) => (ops.some((o) => o.opId === culprit) ? status500() : allApplied(ops));

describe('postOps et serverReachable', () => {
  it('échec : answered vrai si une réponse HTTP est arrivée, faux pour une exception ou un 502/503/504', async () => {
    const answered = serverWithHealth(() => status500());
    await expect(postOps([adj('a')], 1, answered.fetch)).resolves.toEqual({ kind: 'failed', answered: true });
    for (const status of [502, 503, 504]) {
      const gateway = serverWithHealth(() => new Response('', { status }));
      await expect(postOps([adj('a')], 1, gateway.fetch)).resolves.toEqual({ kind: 'failed', answered: false });
    }
    const unreadable = serverWithHealth(() => new Response('pas du json'));
    await expect(postOps([adj('a')], 1, unreadable.fetch)).resolves.toEqual({ kind: 'failed', answered: true });
    const thrown = serverWithHealth(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(postOps([adj('a')], 1, thrown.fetch)).resolves.toEqual({ kind: 'failed', answered: false });
  });

  it('serverReachable : GET /healthz sans cache ; vrai seulement sur une réponse 2xx', async () => {
    const up = vi.fn(async () => new Response('ok', { status: 200 }));
    await expect(serverReachable(up as unknown as typeof fetch)).resolves.toBe(true);
    expect(up).toHaveBeenCalledWith('/healthz', expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }));
    const dbDown = vi.fn(async () => new Response('', { status: 503 }));
    await expect(serverReachable(dbDown as unknown as typeof fetch)).resolves.toBe(false);
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(serverReachable(down as unknown as typeof fetch)).resolves.toBe(false);
  });
});

describe('quarantaine des gestes en échec répété', () => {
  it('MAX_STRIKES vaut 5', () => {
    expect(MAX_STRIKES).toBe(5);
  });

  it('500 → coup sur la tête du lot, status retry', async () => {
    await enqueue(1, adj('a'));
    await enqueue(1, adj('b'));
    const s = serverWithHealth(status500, false);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    expect(out.quarantined).toEqual([]);
    expect(s.health.probes).toBe(0); // an HTTP answer: the server is reachable
    const q = await listQueued(1);
    expect(q.map((x) => [x.op.opId, x.attempts, x.strikes])).toEqual([
      ['a', 1, 1],
      ['b', 1, undefined]
    ]);
  });

  it('erreur réseau + /healthz répond → coup', async () => {
    await enqueue(1, adj('a'));
    const s = serverWithHealth(() => {
      throw new TypeError('Failed to fetch');
    }, true);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    expect(s.health.probes).toBe(1);
    expect((await listQueued(1))[0]).toMatchObject({ attempts: 1, strikes: 1 });
  });

  it('erreur réseau + /healthz échoue → aucun coup, attempts +1', async () => {
    await enqueue(1, adj('a'));
    const s = serverWithHealth(() => {
      throw new TypeError('Failed to fetch');
    }, false);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    expect(s.health.probes).toBe(1);
    const q = await listQueued(1);
    expect(q[0].attempts).toBe(1);
    expect(q[0].strikes).toBeUndefined();
  });

  it('502, 503 puis 504 avec /healthz en 503 → aucun coup, attempts +1, retry', async () => {
    await enqueue(1, adj('a'));
    for (const [i, status] of [502, 503, 504].entries()) {
      const s = serverWithHealth(() => new Response('', { status }), 503);
      const out = await syncNow(1, { fetch: s.fetch });
      expect(out).toMatchObject({ status: 'retry', quarantined: [] });
      expect(s.health.probes).toBe(1);
      const q = await listQueued(1);
      expect(q[0].attempts).toBe(i + 1);
      expect(q[0].strikes).toBeUndefined();
    }
  });

  it('502 avec /healthz en 200 → coup', async () => {
    await enqueue(1, adj('a'));
    const s = serverWithHealth(() => new Response('', { status: 502 }), 200);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    expect(s.health.probes).toBe(1);
    expect((await listQueued(1))[0]).toMatchObject({ attempts: 1, strikes: 1 });
  });

  it('navigator.onLine false → ni envoi ni coup', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await enqueue(1, adj('a'));
    const s = serverWithHealth(status500);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('offline');
    expect(s.calls).not.toHaveBeenCalled();
    const q = await listQueued(1);
    expect(q[0].attempts).toBe(0);
    expect(q[0].strikes).toBeUndefined();
  });

  it('lot [A, B, C], B fait 500 : coup sur A, puis A part seul et passe, puis [B, C] → coup sur B, B part seul ensuite', async () => {
    for (const id of ['A', 'B', 'C']) await enqueue(1, adj(id));
    const s1 = serverWithHealth(failsOn('B'));
    await syncNow(1, { fetch: s1.fetch });
    expect(ids(s1.batches)).toEqual([['A', 'B', 'C']]);
    expect((await listQueued(1)).map((x) => x.strikes)).toEqual([1, undefined, undefined]);

    const s2 = serverWithHealth(failsOn('B'));
    const out2 = await syncNow(1, { fetch: s2.fetch });
    expect(ids(s2.batches)).toEqual([['A'], ['B', 'C']]);
    expect(out2).toMatchObject({ status: 'retry', sent: 1 });
    expect((await listQueued(1)).map((x) => [x.op.opId, x.strikes])).toEqual([
      ['B', 1],
      ['C', undefined]
    ]);

    const s3 = serverWithHealth(failsOn('B'));
    await syncNow(1, { fetch: s3.fetch });
    expect(ids(s3.batches)).toEqual([['B']]);
    expect((await listQueued(1)).map((x) => [x.op.opId, x.strikes])).toEqual([
      ['B', 2],
      ['C', undefined]
    ]);
  });

  it('B échoue seul jusqu’à 5 coups → quarantaine, out.quarantined = [B], C envoyé dans la même synchro', async () => {
    await enqueue(1, adj('B'));
    await enqueue(1, adj('C'));
    for (let i = 1; i < MAX_STRIKES; i++) {
      const out = await syncNow(1, { fetch: serverWithHealth(failsOn('B')).fetch });
      expect(out).toMatchObject({ status: 'retry', quarantined: [] });
    }
    expect((await listQueued(1)).map((x) => [x.op.opId, x.strikes])).toEqual([
      ['B', 4],
      ['C', undefined]
    ]);

    const s = serverWithHealth(failsOn('B'));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches)).toEqual([['B'], ['C']]);
    expect(out).toMatchObject({ status: 'ok', sent: 1, quarantined: ['B'] });
    expect(out.results.map((r) => r.opId)).toEqual(['C']);
    const q = await listQueued(1);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ op: { opId: 'B' }, strikes: 5, attempts: 5 });
    expect(q[0].quarantinedAt).toEqual(expect.any(Number));
  });

  it('consume en quarantaine + review qui le vise → le review n’est pas envoyé, reste en file', async () => {
    await enqueue(1, consume('k'));
    await enqueue(1, review('r', 'k'));
    await enqueue(1, adj('x'));
    for (let i = 1; i < MAX_STRIKES; i++) await strike('k');

    // k goes alone, takes its 5th strike: the next pass holds r back and still sends x.
    const s = serverWithHealth(failsOn('k'));
    const out = await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches)).toEqual([['k'], ['x']]);
    expect(out.quarantined).toEqual(['k']);
    expect((await listQueued(1)).map((x) => x.op.opId)).toEqual(['k', 'r']);

    // Already quarantined (and a verdict added since): neither review is sent.
    await enqueue(1, review('r2', 'k'));
    await enqueue(1, adj('y'));
    const s2 = serverWithHealth(allApplied);
    await syncNow(1, { fetch: s2.fetch });
    expect(ids(s2.batches)).toEqual([['y']]);
    expect((await listQueued(1)).map((x) => x.op.opId)).toEqual(['k', 'r', 'r2']);
  });

  it('geste en quarantaine jamais renvoyé aux synchros suivantes', async () => {
    await enqueue(1, adj('a'));
    await quarantine('a');
    const s = serverWithHealth(allApplied);
    for (let i = 0; i < 3; i++) {
      const out = await syncNow(1, { fetch: s.fetch });
      expect(out).toMatchObject({ status: 'idle', sent: 0, quarantined: [] });
    }
    expect(s.calls).not.toHaveBeenCalled();
    expect((await listQueued(1)).map((x) => x.op.opId)).toEqual(['a']);
  });

  it('400 et rejected : inchangés, aucun coup', async () => {
    await enqueue(1, adj('bad'));
    for (let i = 1; i < MAX_STRIKES; i++) await strike('bad'); // one more strike would quarantine it
    const s400 = serverWithHealth(() => new Response('{"error":"invalid"}', { status: 400 }));
    const dropped = await syncNow(1, { fetch: s400.fetch });
    expect(dropped).toMatchObject({ status: 'ok', quarantined: [] });
    expect(dropped.dropped.map((o) => o.opId)).toEqual(['bad']);
    expect(s400.health.probes).toBe(0);
    expect(await listQueued(1)).toEqual([]);

    await enqueue(1, consume('no'));
    for (let i = 1; i < MAX_STRIKES; i++) await strike('no');
    const sRej = serverWithHealth((ops) =>
      ok(ops.map((o) => ({ opId: o.opId, status: 'rejected' as const, reason: 'empty_lot' as const })))
    );
    const rejected = await syncNow(1, { fetch: sRej.fetch });
    expect(rejected).toMatchObject({ status: 'ok', quarantined: [] });
    expect(rejected.results).toEqual([{ opId: 'no', status: 'rejected', reason: 'empty_lot' }]);
    expect(sRej.health.probes).toBe(0);
    expect(await listQueued(1)).toEqual([]);
  });

  it('réponse 200 au corps illisible → answered, coup sans sonde /healthz', async () => {
    await enqueue(1, adj('a'));
    const s = serverWithHealth(() => new Response('<html>proxy</html>'), false);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.status).toBe('retry');
    expect(s.health.probes).toBe(0);
    expect((await listQueued(1))[0]).toMatchObject({ attempts: 1, strikes: 1 });
  });
});

describe('disjoncteur contre la mise en quarantaine en série', () => {
  /** Distinct, increasing Date.now() values: quarantinedAt and lastSentAt never tie. */
  function steppingClock() {
    let t = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 10));
  }

  /** Runs syncs with `fetch` until `done()` holds (at most `max` syncs). */
  async function syncUntil(fetch: typeof globalThis.fetch, done: () => Promise<boolean>, max = 20) {
    for (let i = 0; i < max && !(await done()); i++) await syncNow(1, { fetch });
  }

  it('premier envoi, sans lastSentAt ni autre quarantaine → la quarantaine est permise', async () => {
    await enqueue(1, adj('a'));
    for (let i = 1; i < MAX_STRIKES; i++) await strike('a');
    expect(await getLastSentAt()).toBeNull();
    const out = await syncNow(1, { fetch: serverWithHealth(status500).fetch });
    expect(out.quarantined).toEqual(['a']);
    expect((await listQueued(1))[0].quarantinedAt).toEqual(expect.any(Number));
  });

  it('lot accepté (2xx) → lastSentAt enregistré ; 500 ou 400 → inchangé', async () => {
    steppingClock();
    await enqueue(1, adj('a'));
    await syncNow(1, { fetch: serverWithHealth(status500).fetch });
    expect(await getLastSentAt()).toBeNull();
    await syncNow(1, { fetch: serverWithHealth(() => new Response('{}', { status: 400 })).fetch });
    expect(await getLastSentAt()).toBeNull();
    await enqueue(1, adj('b'));
    const before = Date.now();
    await syncNow(1, { fetch: serverWithHealth(allApplied).fetch });
    expect(await getLastSentAt()).toBeGreaterThan(before);
  });

  it('tout POST en 500 et /healthz en 200, gestes A, B, C → seul A passe en quarantaine, B reste en file à 5 coups ou plus', async () => {
    steppingClock();
    for (const id of ['A', 'B', 'C']) await enqueue(1, adj(id));
    const s = serverWithHealth(status500, true);
    const strikesOf = async (id: string) => (await listQueued(1)).find((q) => q.op.opId === id)?.strikes ?? 0;
    await syncUntil(s.fetch, async () => (await strikesOf('B')) >= MAX_STRIKES + 2, 40);

    const q = await listQueued(1);
    expect(q.map((x) => x.op.opId)).toEqual(['A', 'B', 'C']);
    expect(q[0].quarantinedAt).toEqual(expect.any(Number));
    expect(q[1].strikes).toBeGreaterThanOrEqual(MAX_STRIKES);
    expect(q[1].quarantinedAt).toBeUndefined();
    expect(q[2].quarantinedAt).toBeUndefined();
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out).toMatchObject({ status: 'retry', quarantined: [], sent: 0 });
    // B stays at the head; C goes alone as the canary and fails too: nothing is quarantined.
    expect(ids(s.batches).slice(-2)).toEqual([['B'], ['C']]);
  });

  it('un envoi réussi depuis la dernière quarantaine → un nouveau geste fautif peut passer en quarantaine', async () => {
    steppingClock();
    for (const id of ['A', 'B', 'C']) await enqueue(1, adj(id));
    const down = serverWithHealth(status500, true);
    const strikesOf = async (id: string) => (await listQueued(1)).find((q) => q.op.opId === id)?.strikes ?? 0;
    await syncUntil(down.fetch, async () => (await strikesOf('B')) >= MAX_STRIKES, 40);
    expect((await listQueued(1)).filter((q) => q.quarantinedAt !== undefined).map((q) => q.op.opId)).toEqual(['A']);

    // The server writes again: B and C go through, A stays quarantined (the user decides).
    const up = serverWithHealth(allApplied);
    const out = await syncNow(1, { fetch: up.fetch });
    expect(out).toMatchObject({ status: 'ok', sent: 2 });
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['A']);

    // A new faulty gesture D can now be quarantined.
    await enqueue(1, adj('D'));
    const s = serverWithHealth(failsOn('D'));
    await syncUntil(s.fetch, async () => (await listQueued(1)).some((q) => q.op.opId === 'D' && q.quarantinedAt !== undefined), MAX_STRIKES + 1);
    const q = await listQueued(1);
    expect(q.map((x) => [x.op.opId, x.quarantinedAt !== undefined])).toEqual([
      ['A', true],
      ['D', true]
    ]);
  });
});

describe('canari quand le disjoncteur est ouvert', () => {
  function steppingClock() {
    let t = 2_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 10));
  }
  /** Answers 500 to any batch holding one of `culprits`, applies the others. */
  const failsOnAny =
    (...culprits: string[]) =>
    (ops: StockOp[]) =>
      ops.some((o) => culprits.includes(o.opId)) ? status500() : allApplied(ops);
  /** Queues Y quarantined (nothing sent since), then X one strike short of quarantine. */
  async function yQuarantinedThenX(x: StockOp = adj('X')) {
    await enqueue(1, adj('Y'));
    for (let i = 0; i < MAX_STRIKES; i++) await strike('Y');
    await quarantine('Y');
    await enqueue(1, x);
    for (let i = 1; i < MAX_STRIKES; i++) await strike(x.opId);
  }

  it('[Y, X, Z], Y et X en 500, /healthz 200 : Z part seul comme canari, puis X passe en quarantaine', async () => {
    steppingClock();
    for (const id of ['Y', 'X', 'Z']) await enqueue(1, adj(id));
    const s = serverWithHealth(failsOnAny('Y', 'X'), true);
    const quarantinedIds = async () => (await listQueued(1)).filter((q) => q.quarantinedAt !== undefined).map((q) => q.op.opId);
    let last;
    for (let i = 0; i < 20 && (await quarantinedIds()).length < 2; i++) last = await syncNow(1, { fetch: s.fetch });
    expect(last).toMatchObject({ status: 'ok', sent: 1, quarantined: ['X'] });
    expect(last!.results.map((r) => r.opId)).toEqual(['Z']);
    expect(ids(s.batches).slice(-2)).toEqual([['X'], ['Z']]);
    expect(await getLastSentAt()).toEqual(expect.any(Number));
    expect((await listQueued(1)).map((q) => [q.op.opId, q.quarantinedAt !== undefined])).toEqual([
      ['Y', true],
      ['X', true]
    ]);

    const later = serverWithHealth(allApplied);
    const out = await syncNow(1, { fetch: later.fetch });
    expect(out.status).toBe('idle');
    expect(later.calls).not.toHaveBeenCalled();
  });

  it('panne générale (tout POST en 500, /healthz 200), Y déjà en quarantaine : aucune nouvelle quarantaine, canari attempts +1 sans coup', async () => {
    await yQuarantinedThenX();
    await enqueue(1, adj('Z'));
    const s = serverWithHealth(status500, true);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out).toMatchObject({ status: 'retry', sent: 0, quarantined: [] });
    expect(ids(s.batches)).toEqual([['X'], ['Z']]);
    const q = await listQueued(1);
    expect(q.map((x) => [x.op.opId, x.attempts, x.strikes, x.quarantinedAt !== undefined])).toEqual([
      ['Y', 0, MAX_STRIKES, true],
      ['X', 1, MAX_STRIKES, false],
      ['Z', 1, undefined, false]
    ]);
    expect(await getLastSentAt()).toBeNull();
  });

  it('un review qui vise X n’est jamais choisi comme canari', async () => {
    await yQuarantinedThenX(consume('X'));
    await enqueue(1, review('R', 'X'));
    await enqueue(1, adj('Z'));
    const s = serverWithHealth(failsOnAny('X'), true);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches)).toEqual([['X'], ['Z']]);
    expect(out).toMatchObject({ status: 'ok', quarantined: ['X'] });
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['Y', 'X', 'R']);
  });

  it('aucun canari possible (seul le review de X suit) → retry, rien en quarantaine', async () => {
    await yQuarantinedThenX(consume('X'));
    await enqueue(1, review('R', 'X'));
    const s = serverWithHealth(failsOnAny('X'), true);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches)).toEqual([['X']]);
    expect(out).toMatchObject({ status: 'retry', quarantined: [] });
    expect((await listQueued(1)).find((q) => q.op.opId === 'R')?.attempts).toBe(0);
  });

  it('canari refusé en 400 → retiré (dropped), retry, X sans quarantaine', async () => {
    await yQuarantinedThenX();
    await enqueue(1, adj('Z'));
    const s = serverWithHealth((ops) => (ops[0].opId === 'Z' ? new Response('{}', { status: 400 }) : status500()), true);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches)).toEqual([['X'], ['Z']]);
    expect(out).toMatchObject({ status: 'retry', quarantined: [] });
    expect(out.dropped.map((o) => o.opId)).toEqual(['Z']);
    expect((await listQueued(1)).map((q) => [q.op.opId, q.quarantinedAt !== undefined])).toEqual([
      ['Y', true],
      ['X', false]
    ]);
  });

  it('canari en 401 → unauthorized, rien retiré ni compté', async () => {
    await yQuarantinedThenX();
    await enqueue(1, adj('Z'));
    const s = serverWithHealth((ops) => (ops[0].opId === 'Z' ? new Response('', { status: 401 }) : status500()), true);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out).toMatchObject({ status: 'unauthorized', quarantined: [] });
    expect((await listQueued(1)).find((q) => q.op.opId === 'Z')).toMatchObject({ attempts: 0 });
  });

  it('canari marqué undo et accepté → son inverse est mis en file, comme pour un lot ordinaire', async () => {
    await yQuarantinedThenX();
    await enqueue(1, consume('Z'));
    await markUndo('Z');
    const s = serverWithHealth((ops) =>
      ops.some((o) => o.opId === 'X')
        ? status500()
        : ok(ops.map((o) => ({ opId: o.opId, status: 'applied' as const, ...(o.kind === 'consume' ? { consumptionId: 42 } : {}) })))
    );
    const out = await syncNow(1, { fetch: s.fetch });
    expect(out.quarantined).toEqual(['X']);
    expect(out.undone).toContain('Z');
    expect(ids(s.batches).slice(0, 2)).toEqual([['X'], ['Z']]);
    expect(s.batches.flat().some((o) => o.kind === 'unconsume')).toBe(true); // the inverse went in the next pass
  });
});

describe('rotation du canari', () => {
  /** Answers 500 to any batch holding one of `culprits`, applies the others. */
  const failsOnAny =
    (...culprits: string[]) =>
    (ops: StockOp[]) =>
      ops.some((o) => culprits.includes(o.opId)) ? status500() : allApplied(ops);

  it('[Y, X, Z, W], Y, X et Z en 500, W en 200, /healthz 200 : W finit par passer, X en quarantaine, Z jamais pour un seul échec de canari', async () => {
    let t = 3_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 10));
    for (const id of ['Y', 'X', 'Z', 'W']) await enqueue(1, adj(id));
    const s = serverWithHealth(failsOnAny('Y', 'X', 'Z'), true);
    const done = async () => {
      const q = await listQueued(1);
      return !q.some((r) => r.op.opId === 'W') && q.some((r) => r.op.opId === 'X' && r.quarantinedAt !== undefined);
    };
    for (let i = 0; i < 15 && !(await done()); i++) await syncNow(1, { fetch: s.fetch });
    expect(await done()).toBe(true);
    const q = await listQueued(1);
    expect(q.map((r) => [r.op.opId, r.quarantinedAt !== undefined])).toEqual([
      ['Y', true],
      ['X', true],
      ['Z', false]
    ]);
    expect((q[2].strikes ?? 0) < MAX_STRIKES).toBe(true);
    expect(s.batches.flat().filter((o) => o.opId === 'W').length).toBeGreaterThan(0);
  });

  it('canari : le moins de tentatives, le premier de la file à égalité', async () => {
    await enqueue(1, adj('Y'));
    for (let i = 0; i < MAX_STRIKES; i++) await strike('Y');
    await quarantine('Y');
    await enqueue(1, adj('X'));
    for (let i = 1; i < MAX_STRIKES; i++) await strike('X');
    for (const id of ['P', 'Q', 'R']) await enqueue(1, adj(id));
    await bumpAttempts(['P']);
    const s = serverWithHealth(failsOnAny('X', 'P', 'Q', 'R'), true);
    await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches)).toEqual([['X'], ['Q']]); // Q and R tie at 0 attempts: Q first
    await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches).slice(2)).toEqual([['X'], ['R']]);
  });

  it('un review dont le consume (pas la tête) est encore en file avant lui n’est jamais canari, même avec moins de tentatives', async () => {
    await enqueue(1, adj('Y'));
    for (let i = 0; i < MAX_STRIKES; i++) await strike('Y');
    await quarantine('Y');
    await enqueue(1, adj('X'));
    for (let i = 1; i < MAX_STRIKES; i++) await strike('X');
    await enqueue(1, consume('C'));
    await enqueue(1, review('R', 'C'));
    await bumpAttempts(['C']);
    await bumpAttempts(['C']);
    await bumpAttempts(['C']);
    const s = serverWithHealth(failsOnAny('X'), true);
    const out = await syncNow(1, { fetch: s.fetch });
    expect(ids(s.batches).slice(0, 2)).toEqual([['X'], ['C']]);
    expect(out.quarantined).toEqual(['X']);
    expect(ids(s.batches).flat().indexOf('R')).toBeGreaterThan(ids(s.batches).flat().indexOf('C'));
  });
});
