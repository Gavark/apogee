import { describe, it, expect } from 'vitest';
import { safeNotificationUrl } from '../../src/lib/push-url';

const origin = 'https://cave.example.com';
describe('safeNotificationUrl', () => {
  it('keeps same-origin paths', () => {
    expect(safeNotificationUrl('/app', origin)).toBe('/app');
    expect(safeNotificationUrl('/app/wines/3', origin)).toBe('/app/wines/3');
    expect(safeNotificationUrl('/app?x=1#y', origin)).toBe('/app?x=1#y');
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', 42, undefined, null, {}])(
    'falls back to /app for %j',
    (raw) => {
      expect(safeNotificationUrl(raw, origin)).toBe('/app');
    }
  );
});
