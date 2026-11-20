import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ goto: vi.fn(async () => {}) }));

import { isLostUpload } from '../../src/lib/label-client';
import { sampleAnalysis } from '../helpers/fake-ai';

describe('isLostUpload', () => {
  it("sans analysisId (réseau, HTTP, stockage) : la photo n'a pas été gardée", () => {
    expect(isLostUpload({ ok: false, analysisId: null, error: 'unavailable' })).toBe(true);
  });
  it('avec un analysisId : la photo est gardée, même si l’analyse a échoué', () => {
    expect(isLostUpload({ ok: false, analysisId: 3, error: 'unavailable' })).toBe(false);
    expect(isLostUpload({ ok: false, analysisId: 3, error: 'limit_reached' })).toBe(false);
    expect(isLostUpload({ ok: true, analysisId: 3, analysis: sampleAnalysis(), model: 'm' })).toBe(false);
  });
  it('invalid_photo a son propre message', () => {
    expect(isLostUpload({ ok: false, analysisId: null, error: 'invalid_photo' })).toBe(false);
  });
});
