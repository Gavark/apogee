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
      return m.form_err_producer_required();
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
    default:
      return m.form_err_year_invalid();
  }
}

/** Display name of a wine: "Producer - Cuvée", or a placeholder when both are empty. */
export const wineTitle = (w: { producer: string | null; cuvee: string | null }): string =>
  [w.producer, w.cuvee].filter(Boolean).join(' - ') || m.wine_unnamed();
