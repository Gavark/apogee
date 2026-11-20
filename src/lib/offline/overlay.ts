// Pure optimistic overlay: applies pending stock ops to a displayed row. Framework-free.
import type { StockOp } from '$lib/stock-ops';

type Lot = { lotId: number; quantity: number; locationId?: number; position?: string };

export function applyPending<T extends { lots: Lot[]; bottles: number }>(row: T, ops: StockOp[]): T {
  const lots = row.lots.map((l) => ({ ...l }));
  const byId = (id: number) => lots.find((l) => l.lotId === id);
  for (const op of ops) {
    if (op.kind === 'consume') {
      const l = byId(op.lotId);
      if (l) l.quantity = Math.max(0, l.quantity - 1);
    } else if (op.kind === 'adjust') {
      const l = byId(op.lotId);
      if (l) l.quantity = Math.max(0, l.quantity + op.delta);
    } else if (op.kind === 'move') {
      const src = byId(op.lotId);
      if (!src) continue;
      const moved = Math.min(op.quantity, src.quantity);
      src.quantity -= moved;
      const dest = lots.find(
        (l) => l !== src && l.locationId === op.toLocationId && l.position === op.toPosition
      );
      if (dest) dest.quantity += moved;
    }
    // unconsume: consumption is not shown on the row.
  }
  return { ...row, lots, bottles: lots.reduce((n, l) => n + l.quantity, 0) };
}
