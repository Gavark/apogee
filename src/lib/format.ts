/** Unix seconds -> localized date, e.g. "19 nov. 2026". */
export function formatDate(unixSec: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(unixSec * 1000));
}

/** Unix seconds -> localized date and time. */
export function formatDateTime(unixSec: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(unixSec * 1000)
  );
}

/** Unix seconds -> short localized day, month and time, e.g. "20/11 14:05". */
export function formatShortDateTime(unixSec: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(unixSec * 1000));
}
