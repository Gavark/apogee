import { validateWindow, type WindowYears } from '$lib/phase';
import { MAX_TEXT_LEN, MIN_VINTAGE } from '$lib/server/wines';
import { COLORS, WINE_FORMATS_CL, type Color } from '$lib/wine-constants';
import { AiError, type AiConfidence, type LabelAnalysis } from './types';

const CONFIDENCES: AiConfidence[] = ['low', 'medium', 'high'];
const MAX_RATIONALE_LEN = 600;
const WINDOW_MAX_AHEAD = 80;

const str = { type: ['string', 'null'] };
const int = { type: ['integer', 'null'] };

/** JSON Schema of the AI output (spec §6.5). Portable: no format/minimum/maximum/pattern. */
export const LABEL_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'is_wine_label', 'producer', 'cuvee', 'appellation', 'region', 'country', 'color',
    'vintage', 'grapes', 'format_cl', 'window', 'confidence', 'rationale'
  ],
  properties: {
    is_wine_label: { type: 'boolean' },
    producer: str,
    cuvee: str,
    appellation: str,
    region: str,
    country: str,
    // Strict structured outputs reject `enum` combined with a type array: nullable enums use anyOf.
    color: { anyOf: [{ type: 'string', enum: [...COLORS] }, { type: 'null' }] },
    vintage: int,
    grapes: str,
    format_cl: int,
    window: {
      type: 'object',
      additionalProperties: false,
      required: ['drink_from', 'peak_from', 'peak_to', 'drink_until'],
      properties: { drink_from: int, peak_from: int, peak_to: int, drink_until: int }
    },
    confidence: { anyOf: [{ type: 'string', enum: [...CONFIDENCES] }, { type: 'null' }] },
    rationale: str
  }
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown, max = MAX_TEXT_LEN): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max).trim();
  return t === '' ? null : t;
}

function intOrNull(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

const NULL_WINDOW: WindowYears = { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null };

/** Turns whatever an AI returned into a safe LabelAnalysis. Throws only if raw is not an object. */
export function normalizeAnalysis(
  raw: unknown,
  opts: { currentYear: number; acquiredYear: number | null }
): LabelAnalysis {
  if (!isRecord(raw)) throw new AiError('invalid_response');

  const confidence = CONFIDENCES.includes(raw.confidence as AiConfidence)
    ? (raw.confidence as AiConfidence)
    : null;
  const rationale = text(raw.rationale, MAX_RATIONALE_LEN);

  if (raw.is_wine_label === false) {
    return {
      isWineLabel: false, producer: null, cuvee: null, appellation: null, region: null,
      country: null, color: null, vintage: null, grapes: null, formatCl: null,
      window: { ...NULL_WINDOW }, confidence, rationale
    };
  }

  const vintage = intOrNull(raw.vintage, MIN_VINTAGE, opts.currentYear);
  const w = isRecord(raw.window) ? raw.window : {};
  const year = (v: unknown) => intOrNull(v, 1900, opts.currentYear + WINDOW_MAX_AHEAD);
  let window: WindowYears = {
    drinkFrom: year(w.drink_from),
    peakFrom: year(w.peak_from),
    peakTo: year(w.peak_to),
    drinkUntil: year(w.drink_until)
  };
  if (validateWindow(window, vintage ?? opts.acquiredYear ?? opts.currentYear) !== null) window = { ...NULL_WINDOW };

  return {
    isWineLabel: true,
    producer: text(raw.producer),
    cuvee: text(raw.cuvee),
    appellation: text(raw.appellation),
    region: text(raw.region),
    country: text(raw.country),
    color: COLORS.includes(raw.color as Color) ? (raw.color as Color) : null,
    vintage,
    grapes: text(raw.grapes),
    formatCl:
      typeof raw.format_cl === 'number' && WINE_FORMATS_CL.includes(raw.format_cl)
        ? raw.format_cl
        : null,
    window,
    confidence,
    rationale
  };
}
