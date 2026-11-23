// Client-side verdict logic: which consumption a verdict targets, the `review` gesture, and the
// optimistic history. Framework-free, so plain tests can import it.
import type { ClientOpResult } from '$lib/stock-client';
import { newOpId } from '$lib/offline/op-id';
import type { StockOp, Verdict } from '$lib/stock-ops';

export type ReviewRef = { consumptionId: number } | { consumeOpId: string };

/** The target of a verdict right after "Bue"; null when nothing was drunk (rejected, error). */
export function reviewRefAfterDrink(op: StockOp, r: ClientOpResult): ReviewRef | null {
  if (r.status === 'queued') return { consumeOpId: op.opId };
  if (r.status === 'applied' && r.consumptionId !== undefined) return { consumptionId: r.consumptionId };
  return null;
}

/** The `review` gesture; the note is trimmed, empty becomes null. */
export function reviewOp(ref: ReviewRef, verdict: Verdict, note: string): StockOp {
  return { opId: newOpId(), kind: 'review', ...ref, verdict, note: note.trim() || null };
}

/** The history with pending verdicts (targeting a consumption id) already applied; the last one wins. */
export function applyPendingReviews<C extends { id: number; verdict: Verdict | null; note: string | null }>(
  list: C[],
  ops: StockOp[]
): C[] {
  const latest = new Map<number, { verdict: Verdict; note: string | null }>();
  for (const op of ops) {
    if (op.kind === 'review' && op.consumptionId !== undefined) latest.set(op.consumptionId, { verdict: op.verdict, note: op.note });
  }
  return list.map((c) => {
    const r = latest.get(c.id);
    return r ? { ...c, verdict: r.verdict, note: r.note } : c;
  });
}
