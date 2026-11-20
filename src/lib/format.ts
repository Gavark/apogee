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
