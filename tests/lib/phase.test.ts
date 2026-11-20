import { describe, it, expect } from 'vitest';
import {
  computePhase,
  currentYear,
  validateWindow,
  HOME_SECTION_ORDER,
  type WindowYears
} from '../../src/lib/phase';

const w: WindowYears = { drinkFrom: 2022, peakFrom: 2025, peakTo: 2030, drinkUntil: 2034 };
const empty: WindowYears = { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null };

describe('computePhase', () => {
  it.each([
    [2021, 'too_young'],
    [2022, 'ready'],
    [2024, 'ready'],
    [2025, 'peak'],
    [2030, 'peak'],
    [2031, 'last_call'],
    [2034, 'last_call'],
    [2035, 'past']
  ])('année %i → %s', (y, p) => expect(computePhase(w, y)).toBe(p));

  it("sans apogée : ready jusqu'à drinkUntil-1, last_call la dernière année", () => {
    const nw = { drinkFrom: 2022, peakFrom: null, peakTo: null, drinkUntil: 2026 };
    expect(computePhase(nw, 2025)).toBe('ready');
    expect(computePhase(nw, 2026)).toBe('last_call');
    expect(computePhase(nw, 2027)).toBe('past');
  });

  it('fenêtre incomplète → unknown', () => {
    expect(computePhase({ ...w, drinkUntil: null }, 2025)).toBe('unknown');
    expect(computePhase({ ...w, drinkFrom: null }, 2025)).toBe('unknown');
    expect(computePhase(empty, 2025)).toBe('unknown');
  });

  it('peakTo === drinkUntil : la dernière année est last_call', () => {
    const pw = { drinkFrom: 2020, peakFrom: 2022, peakTo: 2026, drinkUntil: 2026 };
    expect(computePhase(pw, 2025)).toBe('peak');
    expect(computePhase(pw, 2026)).toBe('last_call');
  });
});

describe('HOME_SECTION_ORDER', () => {
  it("liste les phases dans l'ordre d'affichage", () => {
    expect(HOME_SECTION_ORDER).toEqual(['past', 'last_call', 'peak', 'ready', 'too_young', 'unknown']);
  });
});

describe('currentYear', () => {
  it('suit le fuseau', () => {
    expect(currentYear('Europe/Paris', new Date('2026-12-31T23:30:00Z'))).toBe(2027);
    expect(currentYear('UTC', new Date('2026-12-31T23:30:00Z'))).toBe(2026);
  });
});

describe('validateWindow', () => {
  it('tout vide est valide', () => {
    expect(validateWindow(empty, 2018)).toBeNull();
  });

  it('fenêtre complète valide', () => {
    expect(validateWindow(w, 2018)).toBeNull();
    expect(validateWindow({ ...w, peakFrom: null, peakTo: null }, null)).toBeNull();
  });

  it('un seul de drinkFrom/drinkUntil → partial sur le champ vide', () => {
    expect(validateWindow({ ...empty, drinkFrom: 2022 }, 2018)).toEqual({
      field: 'drinkUntil',
      reason: 'partial'
    });
    expect(validateWindow({ ...empty, drinkUntil: 2030 }, 2018)).toEqual({
      field: 'drinkFrom',
      reason: 'partial'
    });
  });

  it('un seul de peakFrom/peakTo → partial', () => {
    expect(validateWindow({ ...w, peakTo: null }, 2018)).toEqual({
      field: 'peakTo',
      reason: 'partial'
    });
    expect(validateWindow({ ...w, peakFrom: null }, 2018)).toEqual({
      field: 'peakFrom',
      reason: 'partial'
    });
  });

  it("ordre drinkFrom ≤ peakFrom ≤ peakTo ≤ drinkUntil, erreur sur le premier champ fautif", () => {
    expect(validateWindow({ drinkFrom: 2022, peakFrom: 2031, peakTo: 2030, drinkUntil: 2034 }, 2018))
      .toEqual({ field: 'peakFrom', reason: 'order' });
    expect(validateWindow({ drinkFrom: 2022, peakFrom: 2020, peakTo: 2030, drinkUntil: 2034 }, 2018))
      .toEqual({ field: 'peakFrom', reason: 'order' });
    expect(validateWindow({ drinkFrom: 2022, peakFrom: 2025, peakTo: 2035, drinkUntil: 2034 }, 2018))
      .toEqual({ field: 'peakTo', reason: 'order' });
    expect(validateWindow({ drinkFrom: 2030, peakFrom: null, peakTo: null, drinkUntil: 2025 }, 2018))
      .toEqual({ field: 'drinkUntil', reason: 'order' });
  });

  it('pic sans fenêtre de dégustation → partial sur drinkFrom (prioritaire)', () => {
    expect(validateWindow({ ...empty, peakFrom: 2025, peakTo: 2030 }, 2018)).toEqual({
      field: 'drinkFrom',
      reason: 'partial'
    });
    expect(validateWindow({ ...empty, peakFrom: 2025 }, 2018)).toEqual({
      field: 'drinkFrom',
      reason: 'partial'
    });
  });

  it('bornes égales acceptées', () => {
    expect(validateWindow({ drinkFrom: 2022, peakFrom: 2022, peakTo: 2034, drinkUntil: 2034 }, 2018)).toBeNull();
  });

  it('drinkFrom avant refYear → before_ref', () => {
    expect(validateWindow({ drinkFrom: 2016, peakFrom: null, peakTo: null, drinkUntil: 2030 }, 2018))
      .toEqual({ field: 'drinkFrom', reason: 'before_ref' });
    expect(validateWindow({ drinkFrom: 2018, peakFrom: null, peakTo: null, drinkUntil: 2030 }, 2018))
      .toBeNull();
  });
});
