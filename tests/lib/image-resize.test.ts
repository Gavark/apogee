import { it, expect } from 'vitest';
import { fitWithin } from '../../src/lib/image-resize';

it('fitWithin : 4000×3000 → 1600×1200 ; 3000×4000 → 1200×1600 ; 800×600 inchangé', () => {
  expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
});
