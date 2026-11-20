import * as m from '$paraglide/messages';
import type { Color, WineInputError } from '$lib/server/wines';

export const COLOR_OPTIONS: { value: Color; label: () => string }[] = [
  { value: 'red', label: m.color_red },
  { value: 'white', label: m.color_white },
  { value: 'rose', label: m.color_rose },
  { value: 'sparkling', label: m.color_sparkling },
  { value: 'sweet', label: m.color_sweet },
  { value: 'fortified', label: m.color_fortified }
];

export const FORMAT_OPTIONS: { value: number; label: () => string }[] = [
  { value: 37, label: m.format_37 },
  { value: 50, label: m.format_50 },
  { value: 75, label: m.format_75 },
  { value: 150, label: m.format_150 },
  { value: 300, label: m.format_300 },
  { value: 600, label: m.format_600 }
];

const AI_ERRORS: Record<string, () => string> = {
  unavailable: m.add_ai_error_unavailable,
  limit_reached: m.add_ai_error_limit,
  not_configured: m.add_ai_error_not_configured,
  refused: m.add_ai_error_refused,
  auth: m.add_ai_error_auth,
  rate_limited: m.add_ai_error_rate_limited,
  invalid_response: m.add_ai_error_invalid_response,
  invalid_photo: m.add_ai_error_invalid_photo
};

/** The user-facing message for a failed analysis outcome (unknown codes read as "unavailable"). */
export const aiErrorMessage = (code: string): string => (AI_ERRORS[code] ?? m.add_ai_error_unavailable)();

export const confidenceLabel = (c: string | null): string =>
  c === 'high' ? m.add_ai_confidence_high() : c === 'medium' ? m.add_ai_confidence_medium() : m.add_ai_confidence_low();

export const colorLabel = (c: string | null): string | null =>
  COLOR_OPTIONS.find((o) => o.value === c)?.label() ?? null;

export const formatLabel = (cl: number): string => FORMAT_OPTIONS.find((o) => o.value === cl)?.label() ?? `${cl} cl`;

/** The user-facing message for a validation error, to show under its field. */
export function wineErrorMessage(e: WineInputError): string {
  if (e.reason === 'partial') return m.form_err_partial();
  if (e.reason === 'order') return m.form_err_order();
  if (e.reason === 'before_ref') return m.form_err_before_ref();
  switch (e.field) {
    case 'producer':
      return e.reason === 'required' ? m.form_err_producer_required() : m.form_err_text_too_long();
    case 'acquiredYear':
      return e.reason === 'required' ? m.form_err_acquired_required() : m.form_err_year_invalid();
    case 'vintage':
      return m.form_err_vintage_invalid();
    case 'formatCl':
      return m.form_err_format_invalid();
    case 'quantity':
      return m.form_err_quantity_invalid();
    case 'locationId':
      return m.form_err_location_invalid();
    case 'analysisId':
      return m.add_ai_stale();
    case 'cuvee':
    case 'appellation':
    case 'region':
    case 'country':
    case 'grapes':
    case 'position':
    case 'notes':
      return m.form_err_text_too_long();
    default:
      return m.form_err_year_invalid();
  }
}

/** Display name of a wine: "Producer - Cuvée", or a placeholder when both are empty. */
export const wineTitle = (w: { producer: string | null; cuvee: string | null }): string =>
  [w.producer, w.cuvee].filter(Boolean).join(' - ') || m.wine_unnamed();
