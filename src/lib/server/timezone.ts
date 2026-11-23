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

let supported: ReadonlySet<string> | undefined;

/** IANA zones this runtime knows (ICU canonical names), plus UTC. */
function supportedZones(): ReadonlySet<string> {
  supported ??= new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
  return supported;
}

/**
 * The canonical IANA name of `input` (case and aliases resolved, e.g. Asia/Kolkata → Asia/Calcutta on
 * this runtime), or null when it is not a known IANA zone. Offsets such as "+05:00", which
 * Intl.DateTimeFormat accepts, are rejected: an account follows a place, with its daylight saving time.
 */
export function canonicalTimeZone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const zone = input.trim();
  if (!zone || zone.length > 64) return null;
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  return supportedZones().has(resolved) ? resolved : null;
}

export type TimeZoneOption = { id: string; label: string };

let optionsCache: { hour: number; options: TimeZoneOption[] } | undefined;

/**
 * Every supported zone labelled with its current UTC offset ("(UTC−04:00) America/Guadeloupe"),
 * sorted by that offset (west to east), then by name.
 */
export function timeZoneOptions(now: Date = new Date()): TimeZoneOption[] {
  // Offsets only move at daylight-saving changes, which happen on the hour: one computation per hour.
  const hour = Math.floor(now.getTime() / 3_600_000);
  if (optionsCache?.hour === hour) return optionsCache.options;
  const options = [...supportedZones()]
    .map((id) => ({ id, offsetMin: Math.round(zonedParts(now.getTime(), id).offsetMs / 60_000) }))
    .sort((a, b) => a.offsetMin - b.offsetMin || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, offsetMin }) => {
      const abs = Math.abs(offsetMin);
      const sign = offsetMin < 0 ? '−' : '+';
      const offset = `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
      return { id, label: `(${offset}) ${id.replaceAll('_', ' ')}` };
    });
  optionsCache = { hour, options };
  return options;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local date (YYYY-MM-DD), month (YYYY-MM) and hour of the instant `ms` in `timeZone`. */
export function localClock(ms: number, timeZone: string): { date: string; month: string; hour: number } {
  const { y, mo, d, h } = zonedParts(ms, timeZone);
  return { date: `${y}-${pad2(mo)}-${pad2(d)}`, month: `${y}-${pad2(mo)}`, hour: h };
}
