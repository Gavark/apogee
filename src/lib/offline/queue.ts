// Offline queue of stock operations, persisted in IndexedDB. Framework-free: the service worker imports it.
import type { StockOp } from '$lib/stock-ops';

export type QueuedOp = { op: StockOp; userId: number; queuedAt: number; attempts: number };

const DB_NAME = 'apogee-offline';
/** 2: adds the `meta` store (the active user). */
const DB_VERSION = 2;
const STORE = 'ops';
/** Small key/value store: `activeUser` tells the service worker whose queue to send. */
const META = 'meta';
const ACTIVE_USER = 'activeUser';

type Stored = QueuedOp & { seq: number };

let dbPromise: Promise<IDBDatabase> | null = null;
let seqCounter = 0;

/** Test helper: drops the cached connection (use with a fresh IDBFactory). */
export function _resetForTests(): void {
  dbPromise = null;
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      // From any older version: create only what is missing, so queued ops survive the upgrade.
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'op.opId' });
        store.createIndex('userId', 'userId');
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
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

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
  storeName: string = STORE
): Promise<T> {
  let db = await openDb();
  let t: IDBTransaction;
  try {
    t = db.transaction(storeName, mode);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'InvalidStateError')) throw e;
    dbPromise = null; // dead connection: reopen once
    db = await openDb();
    t = db.transaction(storeName, mode);
  }
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  done.catch(() => {}); // never an unhandled rejection; the fn error (or done below) is what surfaces
  const result = await fn(t.objectStore(storeName));
  await done;
  return result;
}

async function allForUser(store: IDBObjectStore, userId: number): Promise<Stored[]> {
  const rows = await wrap(store.index('userId').getAll(userId) as IDBRequest<Stored[]>);
  return rows.sort((a, b) => a.queuedAt - b.queuedAt || a.seq - b.seq);
}

/** Resolves true when the op was added, false when that opId was already queued (the original is kept). */
export function enqueue(userId: number, op: StockOp): Promise<boolean> {
  return tx('readwrite', async (store) => {
    if (await wrap(store.getKey(op.opId))) return false; // keep the original
    const row: Stored = { op, userId, queuedAt: Date.now(), attempts: 0, seq: ++seqCounter };
    await wrap(store.add(row));
    return true;
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

/**
 * Records the logged-in user of this browser (null after logout), so the service worker's
 * Background Sync sends that user's queue and nobody else's.
 */
export function setActiveUser(userId: number | null): Promise<void> {
  return tx(
    'readwrite',
    async (store) => {
      if (userId === null) await wrap(store.delete(ACTIVE_USER));
      else await wrap(store.put(userId, ACTIVE_USER));
    },
    META
  );
}

export function getActiveUser(): Promise<number | null> {
  return tx(
    'readonly',
    async (store) => {
      const v: unknown = await wrap(store.get(ACTIVE_USER));
      return typeof v === 'number' && Number.isInteger(v) ? v : null;
    },
    META
  );
}
