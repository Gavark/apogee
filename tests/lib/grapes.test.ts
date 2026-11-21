import { describe, expect, it } from 'vitest';
import { singleGrape } from '../../src/lib/grapes';

describe('singleGrape', () => {
  it('returns a lone grape name, trimmed', () => {
    expect(singleGrape('Riesling')).toBe('Riesling');
    expect(singleGrape('  Gewurztraminer ')).toBe('Gewurztraminer');
    expect(singleGrape('Pinot Noir')).toBe('Pinot Noir');
  });

  it('returns null for blends', () => {
    expect(singleGrape('Grenache, Syrah')).toBeNull();
    expect(singleGrape('Grenache / Syrah')).toBeNull();
    expect(singleGrape('Grenache et Syrah')).toBeNull();
    expect(singleGrape('Grenache & Syrah')).toBeNull();
    expect(singleGrape('Grenache + Syrah')).toBeNull();
    expect(singleGrape('Grenache; Syrah')).toBeNull();
  });

  it('returns null for annotated or long text', () => {
    expect(singleGrape('Riesling (déduit)')).toBeNull();
    expect(singleGrape('Merlot majoritaire avec un peu de cabernet franc')).toBeNull();
  });

  it('returns null when empty', () => {
    expect(singleGrape(null)).toBeNull();
    expect(singleGrape('')).toBeNull();
    expect(singleGrape('   ')).toBeNull();
  });
});
