import { AiError, type AiProvider, type AnalyzeInput, type LabelAnalysis } from '../../src/lib/server/ai/types';

export function sampleAnalysis(overrides: Partial<LabelAnalysis> = {}): LabelAnalysis {
  return {
    isWineLabel: true,
    producer: 'Château Margaux',
    cuvee: null,
    appellation: 'Margaux',
    region: 'Bordeaux',
    country: 'France',
    color: 'red',
    vintage: 2015,
    grapes: 'Cabernet Sauvignon, Merlot',
    formatCl: 75,
    window: { drinkFrom: 2025, peakFrom: 2030, peakTo: 2045, drinkUntil: 2060 },
    confidence: 'high',
    rationale: 'Grand cru classé, millésime réputé.',
    ...overrides
  };
}

/** A provider that returns `result`, or throws it when it is an AiError. Records every call. */
export function fakeProvider(result: LabelAnalysis | AiError): AiProvider & { calls: AnalyzeInput[] } {
  const calls: AnalyzeInput[] = [];
  return {
    name: 'fake',
    model: 'fake-model',
    calls,
    async analyzeLabel(input: AnalyzeInput) {
      calls.push(input);
      if (result instanceof AiError) throw result;
      return result;
    }
  };
}
