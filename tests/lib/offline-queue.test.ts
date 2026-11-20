import 'fake-indexeddb/auto';
import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bumpAttempts,
  clearQueue,
  countQueued,
  enqueue,
  getActiveUser,
  listQueued,
  removeQueued,
  setActiveUser,
  _resetForTests
} from '$lib/offline/queue';
import type { StockOp } from '$lib/server/stock';

const adj = (opId: string, delta = 1): StockOp => ({ opId, kind: 'adjust', lotId: 1, delta });

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  _resetForTests();
  globalThis.indexedDB = new IDBFactory();
});

describe('file d’opérations hors ligne', () => {
  it('enqueue / list / remove dans l’ordre d’arrivée', async () => {
    await enqueue(1, adj('c'));
    await enqueue(1, adj('a'));
    await enqueue(1, adj('b'));
    const l = await listQueued(1);
    expect(l.map((q) => q.op.opId)).toEqual(['c', 'a', 'b']);
    expect(l[0]).toMatchObject({ userId: 1, attempts: 0 });
    expect(typeof l[0].queuedAt).toBe('number');
    await removeQueued(['a']);
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['c', 'b']);
    expect(await countQueued(1)).toBe(2);
  });

  it('sépare les utilisateurs', async () => {
    await enqueue(1, adj('a'));
    await enqueue(2, adj('b'));
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['a']);
    expect(await countQueued(2)).toBe(1);
  });

  it('même opId deux fois → une seule entrée (la première est conservée)', async () => {
    await enqueue(1, adj('a', 1));
    await enqueue(1, adj('a', 5));
    const l = await listQueued(1);
    expect(l).toHaveLength(1);
    expect(l[0].op).toMatchObject({ delta: 1 });
  });

  it('clearQueue(userId) ne touche que cet utilisateur ; sans argument vide tout', async () => {
    await enqueue(1, adj('a'));
    await enqueue(2, adj('b'));
    await clearQueue(1);
    expect(await countQueued(1)).toBe(0);
    expect(await countQueued(2)).toBe(1);
    await clearQueue();
    expect(await countQueued(2)).toBe(0);
  });

  it('bumpAttempts incrémente les tentatives', async () => {
    await enqueue(1, adj('a'));
    await enqueue(1, adj('b'));
    await bumpAttempts(['a']);
    await bumpAttempts(['a', 'b']);
    const l = await listQueued(1);
    expect(l.map((q) => q.attempts)).toEqual([2, 1]);
  });

  it('une opération qui échoue dans la transaction rejette avec son erreur, sans rejet non géré', async () => {
    const unhandled: unknown[] = [];
    const h = (r: unknown) => unhandled.push(r);
    process.on('unhandledRejection', h);
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore) {
      this.transaction.abort();
      throw new Error('boom');
    });
    await expect(enqueue(1, adj('a'))).rejects.toThrow('boom');
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', h);
    expect(unhandled).toEqual([]);
    vi.restoreAllMocks();
    await enqueue(1, adj('b'));
    expect(await countQueued(1)).toBe(1);
  });

  it('après fermeture de la connexion, la prochaine opération rouvre la base', async () => {
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction');
    await enqueue(1, adj('a'));
    const db = spy.mock.contexts[0] as IDBDatabase;
    spy.mockRestore();
    db.close(); // no onclose event fires on a manual close: exercises the InvalidStateError path
    await enqueue(1, adj('b'));
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['a', 'b']);
  });
});

describe('utilisateur actif (pour le service worker)', () => {
  it('null tant que rien n’est enregistré, puis le dernier enregistré', async () => {
    expect(await getActiveUser()).toBeNull();
    await setActiveUser(3);
    expect(await getActiveUser()).toBe(3);
    await setActiveUser(4);
    expect(await getActiveUser()).toBe(4);
    await setActiveUser(null);
    expect(await getActiveUser()).toBeNull();
  });

  it('ne touche pas à la file', async () => {
    await enqueue(1, adj('a'));
    await setActiveUser(1);
    await clearQueue();
    expect(await getActiveUser()).toBe(1);
    await setActiveUser(null);
    expect(await countQueued(1)).toBe(0);
  });

  it('la mise à niveau depuis la version 1 de la base garde les gestes en file', async () => {
    // A v1 database as Task 1 created it, with one queued op.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('apogee-offline', 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore('ops', { keyPath: 'op.opId' });
        store.createIndex('userId', 'userId');
        store.add({ op: adj('old'), userId: 1, queuedAt: 1, attempts: 0, seq: 1 });
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    expect((await listQueued(1)).map((q) => q.op.opId)).toEqual(['old']);
    await setActiveUser(1);
    expect(await getActiveUser()).toBe(1);
  });
});
