/** Notification target: a same-origin path from the payload, else `/app`. */
export function safeNotificationUrl(raw: unknown, origin: string): string {
  const fallback = '/app';
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return fallback;
  }
  try {
    const u = new URL(raw, origin);
    if (u.origin !== new URL(origin).origin) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
