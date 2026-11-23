import { describe, expect, it } from 'vitest';
import { applyPendingReviews, reviewOp, reviewRefAfterDrink } from '$lib/verdict';
import type { StockOp } from '$lib/stock-ops';

const drink: StockOp = { opId: 'drink-1', kind: 'consume', lotId: 3, consumedOn: '2026-11-20' };

describe('reviewRefAfterDrink', () => {
  it('« Bue » appliqué avec un consumptionId → cette consommation', () => {
    expect(reviewRefAfterDrink(drink, { opId: 'drink-1', status: 'applied', consumptionId: 7 })).toEqual({ consumptionId: 7 });
  });

  it('« Bue » en file (hors ligne) → l’opId du geste', () => {
    expect(reviewRefAfterDrink(drink, { opId: 'drink-1', status: 'queued' })).toEqual({ consumeOpId: 'drink-1' });
  });

  it('« Bue » rejeté → rien à juger', () => {
    expect(reviewRefAfterDrink(drink, { opId: 'drink-1', status: 'rejected', reason: 'empty_lot' })).toBeNull();
  });

  it('appliqué sans consumptionId → rien à juger', () => {
    expect(reviewRefAfterDrink(drink, { opId: 'drink-1', status: 'applied' })).toBeNull();
  });
});

describe('reviewOp', () => {
  it('par consumptionId : note coupée, pas de consumeOpId, opId UUID v4', () => {
    const op = reviewOp({ consumptionId: 7 }, 'late', '  trop tannique ');
    expect(op).toMatchObject({ kind: 'review', consumptionId: 7, verdict: 'late', note: 'trop tannique' });
    expect(op).not.toHaveProperty('consumeOpId');
    expect(op.opId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('note vide ou blanche → null', () => {
    expect(reviewOp({ consumptionId: 7 }, 'right', '')).toMatchObject({ note: null });
    expect(reviewOp({ consumptionId: 7 }, 'right', '   ')).toMatchObject({ note: null });
  });

  it('par consumeOpId : pas de consumptionId', () => {
    const op = reviewOp({ consumeOpId: 'drink-1' }, 'early', '');
    expect(op).toMatchObject({ kind: 'review', consumeOpId: 'drink-1', verdict: 'early' });
    expect(op).not.toHaveProperty('consumptionId');
  });
});

describe('applyPendingReviews', () => {
  const list = () => [
    { id: 7, verdict: null as 'early' | 'right' | 'late' | null, note: null as string | null },
    { id: 8, verdict: 'right' as const, note: 'ok' }
  ];
  const review = (opId: string, target: object, verdict: 'early' | 'right' | 'late', note: string | null): StockOp =>
    ({ opId, kind: 'review', verdict, note, ...target }) as StockOp;

  it('deux verdicts sur la même consommation → le dernier gagne, note comprise', () => {
    const out = applyPendingReviews(list(), [
      review('a', { consumptionId: 7 }, 'early', 'tôt'),
      review('b', { consumptionId: 7 }, 'late', null)
    ]);
    expect(out[0]).toEqual({ id: 7, verdict: 'late', note: null });
    expect(out[1]).toEqual({ id: 8, verdict: 'right', note: 'ok' });
  });

  it('ignore un review par consumeOpId et les autres gestes', () => {
    const out = applyPendingReviews(list(), [review('a', { consumeOpId: 'drink-1' }, 'late', 'x'), drink]);
    expect(out).toEqual(list());
  });

  it('ne modifie pas la liste d’entrée', () => {
    const input = list();
    applyPendingReviews(input, [review('a', { consumptionId: 7 }, 'late', 'x')]);
    expect(input).toEqual(list());
  });
});
