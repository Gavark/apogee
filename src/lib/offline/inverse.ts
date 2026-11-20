// The op that cancels a gesture. Framework-free: the service worker imports it (through sync).
import { newOpId } from './op-id';
import type { OpResult, StockOp } from '$lib/stock-ops';

/** The op that cancels `op`, given its server result; null when there is nothing (or no way) to undo. */
export function inverseOf(op: StockOp, r: OpResult | undefined): StockOp | null {
  if (!r || r.status === 'rejected') return null;
  if (op.kind === 'consume' && r.consumptionId !== undefined) {
    return { opId: newOpId(), kind: 'unconsume', consumptionId: r.consumptionId };
  }
  if (op.kind === 'adjust' && r.appliedQuantity) {
    return { opId: newOpId(), kind: 'adjust', lotId: op.lotId, delta: -r.appliedQuantity };
  }
  return null;
}
