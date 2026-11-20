import { describe, it, expect } from 'vitest';
import { normalizeAnalysis, LABEL_JSON_SCHEMA } from '$lib/server/ai/contract';
import { AiError } from '$lib/server/ai/types';

const Y = 2026;
const opts = { currentYear: Y, acquiredYear: null as number | null };
const NULL_WINDOW = { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null };

describe('normalizeAnalysis', () => {
  it('mappe un JSON valide', () => {
    const a = normalizeAnalysis(
      {
        producer: 'Domaine Santa Duc', cuvee: null, appellation: 'Gigondas', region: 'Rhône',
        country: 'France', color: 'red', vintage: 2018, grapes: 'Grenache, Syrah', format_cl: 75,
        window: { drink_from: 2022, peak_from: 2025, peak_to: 2030, drink_until: 2034 },
        confidence: 'high', rationale: 'Gigondas de bon millésime.', is_wine_label: true
      },
      opts
    );
    expect(a).toMatchObject({
      producer: 'Domaine Santa Duc', color: 'red', vintage: 2018, formatCl: 75,
      window: { drinkFrom: 2022, peakFrom: 2025, peakTo: 2030, drinkUntil: 2034 },
      confidence: 'high', isWineLabel: true
    });
  });

  it('fenêtre dans le désordre → fenêtre entièrement vide', () => {
    const a = normalizeAnalysis(
      { vintage: 2018, window: { drink_from: 2022, peak_from: 2031, peak_to: 2030, drink_until: 2034 } },
      opts
    );
    expect(a.window).toEqual(NULL_WINDOW);
  });

  it('fenêtre avant le millésime → vide ; NV : référence = acquiredYear', () => {
    const before = normalizeAnalysis(
      { vintage: 2018, window: { drink_from: 2015, peak_from: null, peak_to: null, drink_until: 2030 } },
      opts
    );
    expect(before.window).toEqual(NULL_WINDOW);

    const w = { drink_from: 2020, peak_from: null, peak_to: null, drink_until: 2030 };
    const nvBad = normalizeAnalysis({ vintage: null, window: w }, { currentYear: Y, acquiredYear: 2024 });
    expect(nvBad.window).toEqual(NULL_WINDOW);
    const nvOk = normalizeAnalysis({ vintage: null, window: w }, { currentYear: Y, acquiredYear: 2019 });
    expect(nvOk.window).toEqual({ drinkFrom: 2020, peakFrom: null, peakTo: null, drinkUntil: 2030 });
  });

  it('millésime futur, couleur inconnue, format 70 cl → null', () => {
    const a = normalizeAnalysis({ vintage: 2031, color: 'orange', format_cl: 70 }, opts);
    expect(a.vintage).toBeNull();
    expect(a.color).toBeNull();
    expect(a.formatCl).toBeNull();
  });

  it('années non entières ou sous forme de chaîne → null', () => {
    const a = normalizeAnalysis(
      {
        vintage: '2018', format_cl: '75',
        window: { drink_from: 2022.5, peak_from: '2025', peak_to: null, drink_until: 2034 }
      },
      opts
    );
    expect(a.vintage).toBeNull();
    expect(a.formatCl).toBeNull();
    expect(a.window).toEqual(NULL_WINDOW);
  });

  it('années de fenêtre hors bornes (1900 .. année+80) → null', () => {
    const a = normalizeAnalysis(
      { window: { drink_from: 1899, peak_from: null, peak_to: null, drink_until: Y + 81 } },
      opts
    );
    expect(a.window).toEqual(NULL_WINDOW);
    const ok = normalizeAnalysis(
      { window: { drink_from: 1900, peak_from: null, peak_to: null, drink_until: Y + 80 } },
      opts
    );
    expect(ok.window).toMatchObject({ drinkFrom: 1900, drinkUntil: Y + 80 });
  });

  it('textes bornés : 500 caractères → 200 ; rationale 5000 → 600', () => {
    const a = normalizeAnalysis({ producer: 'a'.repeat(500), rationale: 'r'.repeat(5000) }, opts);
    expect(a.producer).toHaveLength(200);
    expect(a.rationale).toHaveLength(600);
  });

  it('textes : trim et vide → null', () => {
    const a = normalizeAnalysis({ producer: '  Chave  ', cuvee: '   ', region: 42 }, opts);
    expect(a.producer).toBe('Chave');
    expect(a.cuvee).toBeNull();
    expect(a.region).toBeNull();
  });

  it('confidence invalide → null', () => {
    expect(normalizeAnalysis({ confidence: 'certain' }, opts).confidence).toBeNull();
    expect(normalizeAnalysis({ confidence: 'low' }, opts).confidence).toBe('low');
  });

  it('is_wine_label absent → true', () => {
    expect(normalizeAnalysis({}, opts).isWineLabel).toBe(true);
  });

  it('is_wine_label false → identité et fenêtre nulles, confidence/rationale gardés', () => {
    const a = normalizeAnalysis(
      {
        is_wine_label: false, producer: 'X', cuvee: 'Y', appellation: 'Z', region: 'R', country: 'C',
        color: 'red', vintage: 2018, grapes: 'G', format_cl: 75,
        window: { drink_from: 2022, peak_from: null, peak_to: null, drink_until: 2030 },
        confidence: 'low', rationale: 'Pas une étiquette.'
      },
      opts
    );
    expect(a).toEqual({
      isWineLabel: false, producer: null, cuvee: null, appellation: null, region: null, country: null,
      color: null, vintage: null, grapes: null, formatCl: null, window: NULL_WINDOW,
      confidence: 'low', rationale: 'Pas une étiquette.'
    });
  });

  it("champs manquants → null, pas d'exception", () => {
    expect(normalizeAnalysis({}, opts).window.drinkFrom).toBeNull();
    expect(normalizeAnalysis({ window: 'x' }, opts).window).toEqual(NULL_WINDOW);
  });

  it('raw non objet → AiError invalid_response', () => {
    for (const raw of ['oops', null, 3, [], undefined]) {
      let caught: unknown;
      try {
        normalizeAnalysis(raw, opts);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AiError);
      expect((caught as AiError).code).toBe('invalid_response');
    }
  });

  it('LABEL_JSON_SCHEMA liste tous les champs du contrat en required, additionalProperties false', () => {
    const s = LABEL_JSON_SCHEMA as any;
    const keys = ['is_wine_label', 'producer', 'cuvee', 'appellation', 'region', 'country', 'color',
      'vintage', 'grapes', 'format_cl', 'window', 'confidence', 'rationale'];
    expect(s.type).toBe('object');
    expect(s.additionalProperties).toBe(false);
    expect(Object.keys(s.properties).sort()).toEqual([...keys].sort());
    expect([...s.required].sort()).toEqual([...keys].sort());
    const w = s.properties.window;
    expect(w.type).toBe('object');
    expect(w.additionalProperties).toBe(false);
    const wk = ['drink_from', 'peak_from', 'peak_to', 'drink_until'];
    expect([...w.required].sort()).toEqual([...wk].sort());
    expect(s.properties.color.enum).toEqual(['red', 'white', 'rose', 'sparkling', 'sweet', 'fortified', null]);
    expect(s.properties.confidence.enum).toEqual(['low', 'medium', 'high', null]);
    expect(JSON.stringify(s)).not.toMatch(/"(format|minimum|maximum|pattern)"/);
  });
});

describe('AiError', () => {
  it('fonctionne avec instanceof et expose code/status', () => {
    const e = new AiError('rate_limited', 429);
    expect(e).toBeInstanceOf(AiError);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('AiError');
    expect(e.code).toBe('rate_limited');
    expect(e.status).toBe(429);
  });
});
