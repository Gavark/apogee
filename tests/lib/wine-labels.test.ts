import { describe, it, expect } from 'vitest';
import { confidenceLabel, verdictLabel } from '../../src/lib/wine-labels';

describe('confidenceLabel', () => {
  it('une confiance absente est neutre, pas « faible »', () => {
    const labels = new Set([
      confidenceLabel('low'),
      confidenceLabel('medium'),
      confidenceLabel('high'),
      confidenceLabel(null)
    ]);
    expect(labels.size).toBe(4);
  });
});

describe('verdictLabel', () => {
  it('chaque verdict a son propre libellé', () => {
    const labels = new Set((['early', 'right', 'late'] as const).map(verdictLabel));
    expect(labels.size).toBe(3);
  });
});
