import { describe, it, expect } from 'vitest';
import { confidenceLabel } from '../../src/lib/wine-labels';

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
