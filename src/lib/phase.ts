// Drinking-phase logic (spec §6.3). Pure: safe to import from client and server.

export type Phase = 'unknown' | 'too_young' | 'ready' | 'peak' | 'last_call' | 'past';

export type WindowYears = {
  drinkFrom: number | null;
  peakFrom: number | null;
  peakTo: number | null;
  drinkUntil: number | null;
};

/** Order of the phase sections on the home screen. */
export const HOME_SECTION_ORDER: Phase[] = [
  'past',
  'last_call',
  'peak',
  'ready',
  'too_young',
  'unknown'
];

export function computePhase(w: WindowYears, year: number): Phase {
  const { drinkFrom, peakFrom, peakTo, drinkUntil } = w;
  if (drinkFrom === null || drinkUntil === null) return 'unknown';
  if (year < drinkFrom) return 'too_young';
  if (year > drinkUntil) return 'past';
  if (year === drinkUntil) return 'last_call';
  if (peakFrom !== null && peakTo !== null) {
    if (year < peakFrom) return 'ready';
    if (year <= peakTo) return 'peak';
    return 'last_call';
  }
  return 'ready';
}

/** Calendar year in the given IANA time zone. Throws RangeError for an invalid zone. */
export function currentYear(timeZone: string, now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(now);
  return Number(year);
}

export type WindowError = {
  field: keyof WindowYears;
  reason: 'partial' | 'order' | 'before_ref';
};

/**
 * Validates a manually entered window. `refYear` is the vintage, or the
 * cellar-entry year for a non-vintage wine. All-empty is valid (phase unknown).
 * A peak without a drinking window is `partial` on drinkFrom (checked first).
 * Precondition: years are integers or null (parsed upstream).
 */
export function validateWindow(w: WindowYears, refYear: number | null): WindowError | null {
  const { drinkFrom, peakFrom, peakTo, drinkUntil } = w;

  if (drinkFrom === null && drinkUntil === null && (peakFrom !== null || peakTo !== null))
    return { field: 'drinkFrom', reason: 'partial' };
  if (drinkFrom === null && drinkUntil !== null) return { field: 'drinkFrom', reason: 'partial' };
  if (drinkFrom !== null && drinkUntil === null) return { field: 'drinkUntil', reason: 'partial' };
  if (peakFrom === null && peakTo !== null) return { field: 'peakFrom', reason: 'partial' };
  if (peakFrom !== null && peakTo === null) return { field: 'peakTo', reason: 'partial' };

  if (drinkFrom !== null && drinkUntil !== null) {
    if (peakFrom !== null && peakTo !== null) {
      if (peakFrom < drinkFrom || peakFrom > peakTo) return { field: 'peakFrom', reason: 'order' };
      if (peakTo > drinkUntil) return { field: 'peakTo', reason: 'order' };
    } else if (drinkFrom > drinkUntil) {
      return { field: 'drinkUntil', reason: 'order' };
    }
    if (refYear !== null && drinkFrom < refYear) return { field: 'drinkFrom', reason: 'before_ref' };
  }
  return null;
}
