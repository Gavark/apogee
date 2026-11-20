import type { OpResult, StockOp } from '$lib/server/stock';

/** A fresh idempotency key. randomUUID needs a secure context; plain-http LAN access falls back. */
export function newOpId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Posts stock operations; resolves with one result per op, rejects on a network or HTTP failure. */
export async function sendStockOps(ops: StockOp[]): Promise<OpResult[]> {
  const res = await fetch('/api/stock/ops', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ops })
  });
  if (!res.ok) throw new Error(`stock ops failed: HTTP ${res.status}`);
  return ((await res.json()) as { results: OpResult[] }).results;
}
