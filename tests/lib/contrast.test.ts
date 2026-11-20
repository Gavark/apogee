import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * WCAG 2.x contrast guard for the design tokens (ported from babysleep).
 *
 * Apogée is read in a dimly lit cellar, one-handed: every text/background
 * pair the components actually use must clear WCAG AA. The values are read
 * out of tokens.css so the thresholds cannot drift away from what ships.
 */

const CSS = readFileSync('src/lib/styles/tokens.css', 'utf8');

/** Slice out one theme block so light and dark values don't get mixed up. */
function block(theme: 'light' | 'dark' | 'dark-media'): string {
  if (theme === 'light') return CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('@media'));
  if (theme === 'dark-media') {
    return CSS.slice(CSS.indexOf('@media (prefers-color-scheme: dark)'), CSS.indexOf(':root[data-theme="dark"]'));
  }
  return CSS.slice(CSS.indexOf(':root[data-theme="dark"]'));
}

/** Every `--name: #hex;` declaration of a block, in order. */
function hexTokens(theme: 'light' | 'dark' | 'dark-media'): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of block(theme).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out.set(match[1], match[2].toUpperCase());
  }
  return out;
}

function token(theme: 'light' | 'dark', name: string): string {
  const hex = hexTokens(theme).get(name);
  if (!hex) throw new Error(`token --${name} not found in ${theme} block`);
  return hex;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and UI components. */
const AA_BODY = 4.5;
const AA_UI = 3;

const SURFACES = ['c-bg-app', 'c-bg-card', 'c-bg-sunken'];
const PHASES = ['unknown', 'too-young', 'ready', 'peak', 'last-call', 'past'];

// [description, foreground token, background tokens, threshold]
const CASES: Array<[string, string, string[], number]> = [
  ['body text', 'c-text', SURFACES, AA_BODY],
  ['muted text', 'c-text-muted', SURFACES, AA_BODY],
  ['link text', 'c-link', ['c-bg-app', 'c-bg-card'], AA_BODY],
  ['label on fill', 'c-on-fill', ['c-fill', 'c-fill-hover'], AA_BODY],
  ['label on danger fill', 'c-on-fill', ['c-danger'], AA_BODY],
  ['inline error text', 'c-danger', ['c-bg-app', 'c-bg-card'], AA_BODY],
  ['toast text', 'c-toast-text', ['c-toast-bg'], AA_BODY],
  ['toast action', 'c-toast-action', ['c-toast-bg'], AA_BODY],
  ['input border', 'c-border-strong', ['c-bg-card'], AA_UI],
  ['current-year marker', 'c-text', ['c-bg-card'], AA_UI],
  // Phase badges: small semibold label on its tinted pill, on every surface.
  ...PHASES.map(
    (p): [string, string, string[], number] => [`badge ${p}`, `c-phase-${p}-fg`, [`c-phase-${p}-bg`], AA_BODY]
  ),
  // Timeline segments are UI graphics: each must stand out from the card.
  ...['ready', 'peak', 'last-call'].map(
    (p): [string, string, string[], number] => [`timeline ${p}`, `c-phase-${p}-mark`, ['c-bg-card'], AA_UI]
  )
];

describe.each(['light', 'dark'] as const)('token contrast (%s)', (theme) => {
  for (const [label, fg, backgrounds, threshold] of CASES) {
    for (const bg of backgrounds) {
      it(`${label}: --${fg} on --${bg} meets ${threshold}:1`, () => {
        const ratio = contrast(token(theme, fg), token(theme, bg));
        expect(
          ratio,
          `--${fg} (${token(theme, fg)}) on --${bg} (${token(theme, bg)}) = ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(threshold);
      });
    }
  }
});

describe('theme blocks', () => {
  it('the prefers-color-scheme dark block matches the explicit dark block', () => {
    // Both blocks must be kept identical by hand; fail if one drifts.
    expect([...hexTokens('dark-media')]).toEqual([...hexTokens('dark')]);
  });

  it('dark mode overrides every light colour token', () => {
    const missing = [...hexTokens('light').keys()].filter((k) => !hexTokens('dark').has(k));
    expect(missing).toEqual([]);
  });
});

describe('colours live only in tokens.css', () => {
  const HARD_CODED = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|:\s*(white|black)\b/;

  it('no other stylesheet hard-codes a colour', () => {
    for (const file of ['src/lib/styles/components.css', 'src/lib/styles/base.css']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(HARD_CODED);
    }
  });

  it('no Svelte <style> block hard-codes a colour', () => {
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.svelte'))
      .map((f) => join('src', f));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const styles = [...readFileSync(file, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
        .map((m) => m[1])
        .join('\n');
      expect(styles, file).not.toMatch(HARD_CODED);
    }
  });
});
