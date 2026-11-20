import { describe, expect, it, vi } from 'vitest';
import { lastOnlineLoad, network, probeServer, recordOnlineLoad, watchNetwork } from '$lib/offline/online.svelte';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v))
  };
}

describe('network', () => {
  it('vaut true hors navigateur (SSR)', () => {
    expect(network.online).toBe(true);
  });

  it('suit navigator.onLine et les événements online / offline', () => {
    const target = new EventTarget();
    const nav = { onLine: false };
    const stop = watchNetwork(target, nav);
    expect(network.online).toBe(false);
    target.dispatchEvent(new Event('online'));
    expect(network.online).toBe(true);
    target.dispatchEvent(new Event('offline'));
    expect(network.online).toBe(false);
    stop();
    target.dispatchEvent(new Event('online'));
    expect(network.online).toBe(false); // no longer listening
    network.online = true;
  });
});

describe('dernier chargement en ligne', () => {
  it('mémorisé par utilisateur', () => {
    const s = memoryStorage();
    expect(lastOnlineLoad(1, s)).toBeNull();
    recordOnlineLoad(1, 1_700_000_000_000, s);
    expect(lastOnlineLoad(1, s)).toBe(1_700_000_000_000);
    expect(lastOnlineLoad(2, s)).toBeNull();
    expect(s.getItem('apogee:last-online:1')).toBe('1700000000000');
  });

  it('valeur illisible ou stockage indisponible → null, sans lever', () => {
    const s = memoryStorage();
    s.setItem('apogee:last-online:1', 'abc');
    expect(lastOnlineLoad(1, s)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    } as unknown as Storage;
    expect(lastOnlineLoad(1, broken)).toBeNull();
    expect(() => recordOnlineLoad(1, 1, broken)).not.toThrow();
    expect(lastOnlineLoad(1, undefined)).toBeNull();
  });
});

describe('probeServer', () => {
  it('toute réponse du serveur → joignable', async () => {
    const f = vi.fn(async () => new Response('db error', { status: 503 }));
    expect(await probeServer(f as unknown as typeof fetch)).toBe(true);
    expect(f).toHaveBeenCalledWith('/healthz', expect.objectContaining({ cache: 'no-store' }));
  });

  it('échec réseau → injoignable', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await probeServer(f as unknown as typeof fetch)).toBe(false);
  });
});
