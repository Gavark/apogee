import { describe, expect, it } from 'vitest';
import { applyPending } from '$lib/offline/overlay';
import type { StockOp } from '$lib/server/stock';

const row = () => ({
  bottles: 3,
  lots: [
    { lotId: 1, locationId: 10, position: 'A', quantity: 2 },
    { lotId: 2, locationId: 10, position: 'B', quantity: 1 },
    { lotId: 3, locationId: 11, position: '', quantity: 0 }
  ]
});

describe('applyPending', () => {
  it('consume −1, borné à 0', () => {
    const ops: StockOp[] = [{ opId: 'a', kind: 'consume', lotId: 1, consumedOn: '2026-01-01' }];
    const r = applyPending(row(), ops);
    expect(r.lots[0].quantity).toBe(1);
    expect(r.bottles).toBe(2);
    const z = applyPending(row(), [{ opId: 'b', kind: 'consume', lotId: 3, consumedOn: '2026-01-01' }]);
    expect(z.lots[2].quantity).toBe(0);
    expect(z.bottles).toBe(3);
  });

  it('adjust delta borné', () => {
    const r = applyPending(row(), [{ opId: 'a', kind: 'adjust', lotId: 1, delta: -5 }]);
    expect(r.lots[0].quantity).toBe(0);
    expect(r.bottles).toBe(1);
    const p = applyPending(row(), [{ opId: 'a', kind: 'adjust', lotId: 1, delta: 3 }]);
    expect(p.lots[0].quantity).toBe(5);
  });

  it('move retire de la source et ajoute à la cible affichée', () => {
    const r = applyPending(row(), [{ opId: 'a', kind: 'move', lotId: 1, toLocationId: 10, toPosition: 'B', quantity: 1 }]);
    expect(r.lots.map((l) => l.quantity)).toEqual([1, 2, 0]);
    expect(r.bottles).toBe(3);
  });

  it('move vers un lot non affiché : retire seulement', () => {
    const r = applyPending(row(), [{ opId: 'a', kind: 'move', lotId: 1, toLocationId: 99, toPosition: 'Z', quantity: 2 }]);
    expect(r.lots[0].quantity).toBe(0);
    expect(r.bottles).toBe(1);
  });

  it('unconsume ignoré, lot inconnu ignoré', () => {
    const r = applyPending(row(), [
      { opId: 'a', kind: 'unconsume', consumptionId: 4 },
      { opId: 'b', kind: 'adjust', lotId: 77, delta: 1 }
    ]);
    expect(r).toEqual(row());
  });

  it('ne modifie pas l’objet reçu', () => {
    const input = row();
    applyPending(input, [{ opId: 'a', kind: 'adjust', lotId: 1, delta: -1 }]);
    expect(input).toEqual(row());
  });
});
