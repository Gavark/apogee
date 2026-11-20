// Stock gestures sent to /api/stock/ops and their results. Types only, no server code: the service worker imports them.

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
