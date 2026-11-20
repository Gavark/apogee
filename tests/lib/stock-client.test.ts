import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { goto } = vi.hoisted(() => ({ goto: vi.fn(async () => {}) }));
vi.mock('$app/navigation', () => ({ goto }));

import { sendStockOps, SessionExpiredError } from '../../src/lib/stock-client';

const op = { opId: '11111111-1111-4111-8111-111111111111', kind: 'adjust', lotId: 1, delta: 1 } as const;

describe('sendStockOps', () => {
  beforeEach(() => goto.mockClear());
  afterEach(() => vi.unstubAllGlobals());

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
