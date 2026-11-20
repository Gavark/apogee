import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf-8')) as { id?: string; start_url?: string };

describe('manifeste de l’appli installée', () => {
  it('démarre sur /app (servie hors ligne depuis la copie)', () => {
    expect(manifest.start_url).toBe('/app');
  });

  it('garde l’identité « / » des installations existantes malgré le changement de start_url', () => {
    expect(manifest.id).toBe('/');
  });
});
