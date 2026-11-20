import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_CACHE } from '$lib/offline/page-cache';
import { getActiveUser, setActiveUser, _resetForTests } from '$lib/offline/queue';
import { becomeActiveUser, leaveActiveUser } from '$lib/offline/session';

let deleted: string[];

beforeEach(() => {
  _resetForTests();
  globalThis.indexedDB = new IDBFactory();
  deleted = [];
  vi.stubGlobal('caches', {
    delete: vi.fn(async (name: string) => {
      deleted.push(name);
      return true;
    })
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('cloisonnement par utilisateur', () => {
  it('premier utilisateur : enregistré, cache conservé', async () => {
    await becomeActiveUser(1);
    expect(await getActiveUser()).toBe(1);
    expect(deleted).toEqual([]);
  });

  it('même utilisateur : rien ne change', async () => {
    await setActiveUser(1);
    await becomeActiveUser(1);
    expect(deleted).toEqual([]);
  });

  it('autre compte sans déconnexion : pages en cache supprimées avant de changer', async () => {
    await setActiveUser(1);
    await becomeActiveUser(2);
    expect(deleted).toEqual([PAGE_CACHE]);
    expect(await getActiveUser()).toBe(2);
  });

  it('après une déconnexion : pas de second effacement', async () => {
    await setActiveUser(1);
    await leaveActiveUser();
    expect(deleted).toEqual([PAGE_CACHE]);
    expect(await getActiveUser()).toBeNull();
    await becomeActiveUser(2);
    expect(deleted).toEqual([PAGE_CACHE]);
    expect(await getActiveUser()).toBe(2);
  });

  it('l’échec de l’effacement laisse l’ancien utilisateur actif (nouvel essai au prochain chargement)', async () => {
    await setActiveUser(1);
    vi.stubGlobal('caches', { delete: vi.fn(async () => Promise.reject(new Error('quota'))) });
    await expect(becomeActiveUser(2)).rejects.toThrow('quota');
    expect(await getActiveUser()).toBe(1);
  });
});
