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

/** Local calendar fields of an instant in `timeZone`, plus the zone's UTC offset at that instant. Throws RangeError for an invalid zone. */
export function zonedParts(
  ms: number,
  timeZone: string
): { y: number; mo: number; d: number; h: number; offsetMs: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return { y: n('year'), mo: n('month'), d: n('day'), h: n('hour'), offsetMs: asUtc - Math.floor(ms / 1000) * 1000 };
}
