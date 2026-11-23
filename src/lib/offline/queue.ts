// Offline queue of stock operations, persisted in IndexedDB. Framework-free: the service worker imports it.
import type { StockOp } from '$lib/stock-ops';

/**
 * `undo`: the user undid this gesture while its fate was unknown (maybe applied): whoever sends it
 * queues its inverse once its result is known. `inverseOf`: this op cancels that (undone) gesture.
 * Kept in IndexedDB, so an undo survives the app being closed before the network returns.
 */
export type QueuedOp = {
  op: StockOp;
  userId: number;
  queuedAt: number;
  attempts: number;
  undo?: true;
  inverseOf?: string;
  /** Failures the server blamed on this gesture itself (not on the network). */
  strikes?: number;
  /** Set when the gesture is blocked after too many strikes: it is no longer sent until released. */
  quarantinedAt?: number;
};

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
  return tx('readwrite', (store) => addRow(store, userId, op));
}

async function addRow(store: IDBObjectStore, userId: number, op: StockOp, inverseOf?: string): Promise<boolean> {
  if (await wrap(store.getKey(op.opId))) return false; // keep the original
  const row: Stored = { op, userId, queuedAt: Date.now(), attempts: 0, seq: ++seqCounter };
  if (inverseOf !== undefined) row.inverseOf = inverseOf;
  await wrap(store.add(row));
  return true;
}

export async function listQueued(userId: number): Promise<QueuedOp[]> {
  const rows = await tx('readonly', (store) => allForUser(store, userId));
  return rows.map(({ op, userId: u, queuedAt, attempts, undo, inverseOf, strikes, quarantinedAt }) => ({
    op,
    userId: u,
    queuedAt,
    attempts,
    ...(undo ? { undo } : {}),
    ...(inverseOf !== undefined ? { inverseOf } : {}),
    ...(strikes !== undefined ? { strikes } : {}),
    ...(quarantinedAt !== undefined ? { quarantinedAt } : {})
  }));
}

/** An inverse to queue for the user of an undone gesture (see `undo`). */
export type QueuedInverse = { userId: number; op: StockOp; inverseOf: string };

/** Removes the ops and, in the same transaction, queues `inverses`: an undo is never half recorded. */
export function removeQueued(opIds: string[], inverses: QueuedInverse[] = []): Promise<void> {
  return tx('readwrite', async (store) => {
    await Promise.all(opIds.map((id) => wrap(store.delete(id))));
    for (const i of inverses) await addRow(store, i.userId, i.op, i.inverseOf);
  });
}

/**
 * Flags a queued gesture as undone: its inverse is queued once its result is known, by whichever
 * context sends it. Call it holding the sync lock. Resolves false when the op is no longer queued.
 */
export function markUndo(opId: string): Promise<boolean> {
  return tx('readwrite', async (store) => {
    const row = await wrap(store.get(opId) as IDBRequest<Stored | undefined>);
    if (!row) return false;
    await wrap(store.put({ ...row, undo: true }));
    return true;
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

/** Adds one strike to a queued gesture and resolves the new total (0 when it is no longer queued). */
export function strike(opId: string): Promise<number> {
  return tx('readwrite', async (store) => {
    const row = await wrap(store.get(opId) as IDBRequest<Stored | undefined>);
    if (!row) return 0;
    const strikes = (row.strikes ?? 0) + 1;
    await wrap(store.put({ ...row, strikes }));
    return strikes;
  });
}

/** Blocks a queued gesture: it stays in the queue but is no longer sent until released. */
export function quarantine(opId: string, at: number = Date.now()): Promise<void> {
  return tx('readwrite', async (store) => {
    const row = await wrap(store.get(opId) as IDBRequest<Stored | undefined>);
    if (row) await wrap(store.put({ ...row, quarantinedAt: at }));
  });
}

/** Lifts the quarantine and sets the strike count; resolves false when the gesture is no longer queued. */
export function releaseQuarantine(opId: string, strikes: number): Promise<boolean> {
  return tx('readwrite', async (store) => {
    const row = await wrap(store.get(opId) as IDBRequest<Stored | undefined>);
    if (!row) return false;
    const { quarantinedAt: _dropped, ...rest } = row;
    await wrap(store.put({ ...rest, strikes }));
    return true;
  });
}

/** A quarantined gesture and the reviews held back because they target it (a consume). */
export type QuarantineItem = { row: QueuedOp; held: QueuedOp[] };

/** Pure: splits the queue into what can be sent and what is blocked (with the reviews depending on it). */
export function splitQuarantine(rows: QueuedOp[]): { sendable: QueuedOp[]; quarantined: QuarantineItem[] } {
  const blocked = rows.filter((r) => r.quarantinedAt !== undefined);
  const heldIds = new Set<string>();
  const quarantined = blocked.map((row) => {
    const held = rows.filter(
      (r) => r.quarantinedAt === undefined && r.op.kind === 'review' && r.op.consumeOpId === row.op.opId
    );
    for (const h of held) heldIds.add(h.op.opId);
    return { row, held };
  });
  const sendable = rows.filter((r) => r.quarantinedAt === undefined && !heldIds.has(r.op.opId));
  return { sendable, quarantined };
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
