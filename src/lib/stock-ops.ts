// Stock gestures sent to /api/stock/ops and their results. Types and a constant, no server code: the service worker imports them.

/** How a bottle turned out once drunk: opened too early, at its peak, or too late. */
export type Verdict = 'early' | 'right' | 'late';
export const VERDICTS: readonly Verdict[] = ['early', 'right', 'late'];

export type StockOp =
  | { opId: string; kind: 'consume'; lotId: number; consumedOn: string; rating?: number | null; note?: string | null }
  | { opId: string; kind: 'adjust'; lotId: number; delta: number }
  | { opId: string; kind: 'move'; lotId: number; toLocationId: number; toPosition: string; quantity: number }
  | { opId: string; kind: 'unconsume'; consumptionId: number }
  // Targets a consumption by id, or by the opId of the 'consume' that created it (id unknown while offline): exactly one.
  | { opId: string; kind: 'review'; consumptionId?: number; consumeOpId?: string; verdict: Verdict; note: string | null };

export type OpResult = {
  opId: string;
  status: 'applied' | 'partial' | 'rejected';
  appliedQuantity?: number;
  consumptionId?: number;
  reason?: 'empty_lot' | 'not_found' | 'invalid';
};
