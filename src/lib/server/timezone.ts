export const DEFAULT_TIMEZONE = 'Europe/Paris';

/** The instance time zone: `TZ` when it is a valid IANA zone, else Europe/Paris. Used for new accounts. */
export function resolveInstanceTimezone(tz: string | undefined = process.env.TZ): string {
  const zone = tz?.trim();
  if (!zone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
