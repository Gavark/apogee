import { describe, it, expect, vi } from 'vitest';
import { unsubscribeThisDevice } from '../../src/lib/push-client';

const sub = () => ({ endpoint: 'https://push/x', unsubscribe: vi.fn(async () => true) });
const sw = (s: ReturnType<typeof sub> | null) => ({ ready: Promise.resolve({ pushManager: { getSubscription: async () => s } }) });

describe('unsubscribeThisDevice', () => {
  it('posts the endpoint then unsubscribes the browser', async () => {
    const s = sub();
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    await unsubscribeThisDevice({ serviceWorker: sw(s), fetch: f as unknown as typeof fetch });
    expect(f).toHaveBeenCalledWith('/api/push/unsubscribe', expect.objectContaining({ body: JSON.stringify({ endpoint: 'https://push/x' }) }));
    expect(s.unsubscribe).toHaveBeenCalled();
  });
  it('no-op without service worker or subscription', async () => {
    const f = vi.fn();
    await unsubscribeThisDevice({ fetch: f as unknown as typeof fetch });
    await unsubscribeThisDevice({ serviceWorker: sw(null), fetch: f as unknown as typeof fetch });
    expect(f).not.toHaveBeenCalled();
  });
  it('never throws and still unsubscribes when the request fails', async () => {
    const s = sub();
    await unsubscribeThisDevice({ serviceWorker: sw(s), fetch: (async () => { throw new Error('offline'); }) as unknown as typeof fetch });
    expect(s.unsubscribe).toHaveBeenCalled();
  });
  it('gives up after the timeout when the service worker never becomes ready', async () => {
    const t0 = Date.now();
    await unsubscribeThisDevice({ serviceWorker: { ready: new Promise(() => {}) }, fetch: vi.fn() as unknown as typeof fetch }, 50);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
