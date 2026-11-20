// Offline queue of stock operations, persisted in IndexedDB. Framework-free: the service worker imports it.
import type { StockOp } from '$lib/server/stock';

export type QueuedOp = { op: StockOp; userId: number; queuedAt: number; attempts: number };

const DB_NAME = 'apogee-offline';
const STORE = 'ops';

type Stored = QueuedOp & { seq: number };

let dbPromise: Promise<IDBDatabase> | null = null;
let seqCounter = 0;

/** Test helper: drops the cached connection (use with a fresh IDBFactory). */
export function _resetForTests(): void {
  dbPromise = null;
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'op.opId' });
      store.createIndex('userId', 'userId');
    };
    req.onsuccess = () => {
      const db = req.result;
      // Connection closed by the browser or superseded by an upgrade: forget it so the next call reopens.
      db.onclose = () => {
        dbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onblocked = () => {};
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

const wrap = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  let db = await openDb();
  let t: IDBTransaction;
  try {
    t = db.transaction(STORE, mode);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'InvalidStateError')) throw e;
    dbPromise = null; // dead connection: reopen once
    db = await openDb();
    t = db.transaction(STORE, mode);
  }
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  done.catch(() => {}); // never an unhandled rejection; the fn error (or done below) is what surfaces
  const result = await fn(t.objectStore(STORE));
  await done;
  return result;
}

async function allForUser(store: IDBObjectStore, userId: number): Promise<Stored[]> {
  const rows = await wrap(store.index('userId').getAll(userId) as IDBRequest<Stored[]>);
  return rows.sort((a, b) => a.queuedAt - b.queuedAt || a.seq - b.seq);
}

export function enqueue(userId: number, op: StockOp): Promise<void> {
  return tx('readwrite', async (store) => {
    if (await wrap(store.getKey(op.opId))) return; // keep the original
    const row: Stored = { op, userId, queuedAt: Date.now(), attempts: 0, seq: ++seqCounter };
    await wrap(store.add(row));
  });
}

export async function listQueued(userId: number): Promise<QueuedOp[]> {
  const rows = await tx('readonly', (store) => allForUser(store, userId));
  return rows.map(({ op, userId: u, queuedAt, attempts }) => ({ op, userId: u, queuedAt, attempts }));
}

export function removeQueued(opIds: string[]): Promise<void> {
  return tx('readwrite', async (store) => {
    await Promise.all(opIds.map((id) => wrap(store.delete(id))));
  });
}

export function bumpAttempts(opIds: string[]): Promise<void> {
  return tx('readwrite', async (store) => {
    for (const id of opIds) {
      const row = await wrap(store.get(id) as IDBRequest<Stored | undefined>);
      if (row) await wrap(store.put({ ...row, attempts: row.attempts + 1 }));
    }
  });
}

export function countQueued(userId: number): Promise<number> {
  return tx('readonly', (store) => wrap(store.index('userId').count(userId)));
}

export function clearQueue(userId?: number): Promise<void> {
  return tx('readwrite', async (store) => {
    if (userId === undefined) {
      await wrap(store.clear());
      return;
    }
    const keys = await wrap(store.index('userId').getAllKeys(userId));
    await Promise.all(keys.map((k) => wrap(store.delete(k))));
  });
}
