import { and, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';
import type { HouseholdCtx } from './context';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

const { stockLots, wines, locations, consumptions, appliedOps } = schema;

export type StockOp =
  | { opId: string; kind: 'consume'; lotId: number; consumedOn: string; rating?: number | null; note?: string | null }
  | { opId: string; kind: 'adjust'; lotId: number; delta: number }
  | { opId: string; kind: 'move'; lotId: number; toLocationId: number; toPosition: string; quantity: number }
  | { opId: string; kind: 'unconsume'; consumptionId: number };

export type OpResult = {
  opId: string;
  status: 'applied' | 'partial' | 'rejected';
  appliedQuantity?: number;
  consumptionId?: number;
  reason?: 'empty_lot' | 'not_found' | 'invalid';
};

export const MAX_OPS_PER_REQUEST = 100;
export const MAX_STOCK_DELTA = 10000;
export const MAX_POSITION_LEN = 100;
export const MAX_NOTE_LEN = 2000;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1 && (v as number) <= MAX_STOCK_DELTA;

function isCalendarDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function parseOp(raw: unknown): StockOp | null {
  if (!isRecord(raw)) return null;
  const { opId, kind } = raw;
  if (typeof opId !== 'string' || !UUID_V4.test(opId)) return null;
  // Case-insensitive on the wire, canonical (lowercase) everywhere after: a replay with other casing is the same op.
  const id = opId.toLowerCase();
  switch (kind) {
    case 'consume': {
      const { lotId, consumedOn, rating, note } = raw;
      if (!isId(lotId) || !isCalendarDate(consumedOn)) return null;
      if (rating != null && !(Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 5)) return null;
      if (note != null && (typeof note !== 'string' || note.length > MAX_NOTE_LEN)) return null;
      return {
        opId: id,
        kind,
        lotId,
        consumedOn,
        rating: (rating as number | null | undefined) ?? null,
        note: (note as string | null | undefined) ?? null
      };
    }
    case 'adjust': {
      const { lotId, delta } = raw;
      if (!isId(lotId) || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta as number) > MAX_STOCK_DELTA) return null;
      return { opId: id, kind, lotId, delta: delta as number };
    }
    case 'move': {
      const { lotId, toLocationId, toPosition, quantity } = raw;
      if (!isId(lotId) || !isId(toLocationId) || typeof toPosition !== 'string') return null;
      if (!isCount(quantity)) return null;
      const position = toPosition.trim();
      if (position.length > MAX_POSITION_LEN) return null;
      return { opId: id, kind, lotId, toLocationId, toPosition: position, quantity };
    }
    case 'unconsume': {
      const { consumptionId } = raw;
      if (!isId(consumptionId)) return null;
      return { opId: id, kind, consumptionId };
    }
    default:
      return null;
  }
}

export function parseStockOps(body: unknown): { ok: true; ops: StockOp[] } | { ok: false; error: string } {
  if (!isRecord(body) || !Array.isArray(body.ops)) return { ok: false, error: 'ops must be an array' };
  if (body.ops.length < 1 || body.ops.length > MAX_OPS_PER_REQUEST) {
    return { ok: false, error: `ops must contain 1 to ${MAX_OPS_PER_REQUEST} operations` };
  }
  const ops: StockOp[] = [];
  for (let i = 0; i < body.ops.length; i++) {
    const op = parseOp(body.ops[i]);
    if (!op) return { ok: false, error: `invalid operation at index ${i}` };
    ops.push(op);
  }
  return { ok: true, ops };
}

const rejected = (opId: string, reason: NonNullable<OpResult['reason']>): OpResult => ({ opId, status: 'rejected', reason });

/** A lot belongs to a household through its wine. */
function findOwnedLot(db: DB, ctx: HouseholdCtx, lotId: number) {
  return db
    .select({
      id: stockLots.id,
      wineId: stockLots.wineId,
      locationId: stockLots.locationId,
      position: stockLots.position,
      quantity: stockLots.quantity
    })
    .from(stockLots)
    .innerJoin(wines, eq(wines.id, stockLots.wineId))
    .where(and(eq(stockLots.id, lotId), eq(wines.householdId, ctx.householdId)))
    .get();
}

function locationOwned(db: DB, ctx: HouseholdCtx, locationId: number): boolean {
  return !!db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.householdId, ctx.householdId)))
    .get();
}

/** Adds `qty` bottles to the lot (wineId, locationId, position), creating it if needed. */
function addToLot(db: DB, wineId: number, locationId: number, position: string, qty: number): void {
  db.insert(stockLots)
    .values({ wineId, locationId, position, quantity: qty })
    .onConflictDoUpdate({
      target: [stockLots.wineId, stockLots.locationId, stockLots.position],
      set: { quantity: sql`${stockLots.quantity} + ${qty}` }
    })
    .run();
}

function consume(db: DB, ctx: HouseholdCtx, op: Extract<StockOp, { kind: 'consume' }>): OpResult {
  const lot = findOwnedLot(db, ctx, op.lotId);
  if (!lot) return rejected(op.opId, 'not_found');
  if (lot.quantity <= 0) return rejected(op.opId, 'empty_lot');
  db.update(stockLots).set({ quantity: lot.quantity - 1 }).where(eq(stockLots.id, lot.id)).run();
  const row = db
    .insert(consumptions)
    .values({
      wineId: lot.wineId,
      lotId: lot.id,
      locationId: lot.locationId,
      userId: ctx.userId,
      consumedOn: op.consumedOn,
      rating: op.rating ?? null,
      note: op.note ?? null
    })
    .returning({ id: consumptions.id })
    .get();
  return { opId: op.opId, status: 'applied', consumptionId: row.id };
}

function adjust(db: DB, ctx: HouseholdCtx, op: Extract<StockOp, { kind: 'adjust' }>): OpResult {
  const lot = findOwnedLot(db, ctx, op.lotId);
  if (!lot) return rejected(op.opId, 'not_found');
  const next = Math.max(0, lot.quantity + op.delta);
  const applied = next - lot.quantity;
  db.update(stockLots).set({ quantity: next }).where(eq(stockLots.id, lot.id)).run();
  return { opId: op.opId, status: applied === op.delta ? 'applied' : 'partial', appliedQuantity: applied };
}

function move(db: DB, ctx: HouseholdCtx, op: Extract<StockOp, { kind: 'move' }>): OpResult {
  const lot = findOwnedLot(db, ctx, op.lotId);
  if (!lot || !locationOwned(db, ctx, op.toLocationId)) return rejected(op.opId, 'not_found');
  if (lot.locationId === op.toLocationId && lot.position === op.toPosition) return rejected(op.opId, 'invalid');
  if (lot.quantity <= 0) return rejected(op.opId, 'empty_lot');
  const moved = Math.min(op.quantity, lot.quantity);
  db.update(stockLots).set({ quantity: lot.quantity - moved }).where(eq(stockLots.id, lot.id)).run();
  addToLot(db, lot.wineId, op.toLocationId, op.toPosition, moved);
  return { opId: op.opId, status: moved === op.quantity ? 'applied' : 'partial', appliedQuantity: moved };
}

function unconsume(db: DB, ctx: HouseholdCtx, op: Extract<StockOp, { kind: 'unconsume' }>): OpResult {
  const c = db
    .select({
      id: consumptions.id,
      wineId: consumptions.wineId,
      lotId: consumptions.lotId,
      locationId: consumptions.locationId
    })
    .from(consumptions)
    .innerJoin(wines, eq(wines.id, consumptions.wineId))
    .where(and(eq(consumptions.id, op.consumptionId), eq(wines.householdId, ctx.householdId)))
    .get();
  if (!c || c.locationId === null) return rejected(op.opId, 'not_found');
  const original = c.lotId === null ? undefined : findOwnedLot(db, ctx, c.lotId);
  if (original) {
    db.update(stockLots).set({ quantity: original.quantity + 1 }).where(eq(stockLots.id, original.id)).run();
  } else {
    addToLot(db, c.wineId, c.locationId, '', 1);
  }
  db.delete(consumptions).where(eq(consumptions.id, c.id)).run();
  return { opId: op.opId, status: 'applied', consumptionId: c.id };
}

function applyOne(db: DB, ctx: HouseholdCtx, op: StockOp): OpResult {
  switch (op.kind) {
    case 'consume':
      return consume(db, ctx, op);
    case 'adjust':
      return adjust(db, ctx, op);
    case 'move':
      return move(db, ctx, op);
    case 'unconsume':
      return unconsume(db, ctx, op);
  }
}

/**
 * Applies each op in its own transaction, idempotently by opId. A replayed opId returns the stored
 * result verbatim; an opId owned by another household is rejected not_found and leaves no trace.
 */
export function applyStockOps(db: DB, ctx: HouseholdCtx, ops: StockOp[]): OpResult[] {
  return ops.map((op) =>
    db.transaction(
      (tx) => {
        const prior = tx
          .select({ householdId: appliedOps.householdId, result: appliedOps.result })
          .from(appliedOps)
          .where(eq(appliedOps.opId, op.opId))
          .get();
        if (prior) {
          return prior.householdId === ctx.householdId
            ? (JSON.parse(prior.result) as OpResult)
            : rejected(op.opId, 'not_found');
        }
        const result = applyOne(tx, ctx, op);
        tx.insert(appliedOps).values({ opId: op.opId, householdId: ctx.householdId, result: JSON.stringify(result) }).run();
        return result;
      },
      { behavior: 'immediate' }
    )
  );
}
