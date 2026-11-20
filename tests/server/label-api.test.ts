import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import { fakeProvider, sampleAnalysis } from '../helpers/fake-ai';
import { handleAnalyze, parseHints } from '../../src/routes/api/label/analyze/_logic';
import { POST } from '../../src/routes/api/label/analyze/+server';
import { createWine, type WineInput } from '../../src/lib/server/wines';
import type { HouseholdCtx } from '../../src/lib/server/context';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

let tdb: ReturnType<typeof makeTestDb>;
let dir: string;
let ctx: HouseholdCtx;
const env = () => ({ timeZone: 'Europe/Paris', locale: 'fr' as const, currentYear: 2026, dailyLimit: 0, photosDir: dir });

beforeEach(() => {
  tdb = makeTestDb();
  dir = mkdtempSync(join(tmpdir(), 'apogee-api-'));
  const hid = makeHousehold(tdb);
  ctx = { userId: makeUser(tdb, hid), householdId: hid, isAdmin: false };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function mkWine(c: HouseholdCtx): number {
  const w: WineInput = {
    producer: 'Margaux', cuvee: 'Pavillon', appellation: 'Margaux', region: null, country: null, color: 'red',
    vintage: 2015, grapes: null, formatCl: 75, acquiredYear: 2020,
    window: { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null },
    notes: null
  };
  const loc = makeLocation(tdb, c.householdId, `Cave ${Math.random()}`);
  return createWine(tdb.db, c, w, { locationId: loc, position: '', quantity: 1 }).wineId;
}

function form(entries: Record<string, string | Blob>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v === 'string') f.append(k, v);
    else f.append(k, v, 'label.jpg');
  }
  return f;
}

describe('handleAnalyze', () => {
  it('photo JPEG → 200 ok:true avec analysisId', async () => {
    const p = fakeProvider(sampleAnalysis());
    const r = await handleAnalyze(tdb.db, ctx, p, form({ photo: new Blob([JPEG], { type: 'image/jpeg' }) }), env());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, analysisId: expect.any(Number) });
    expect(p.calls[0].image).not.toBeNull();
  });

  it('rien de fourni → 400 invalid_request ; hints non JSON → 400', async () => {
    const p = fakeProvider(sampleAnalysis());
    expect(await handleAnalyze(tdb.db, ctx, p, form({}), env())).toEqual({ status: 400, body: { error: 'invalid_request' } });
    expect(await handleAnalyze(tdb.db, ctx, p, form({ hints: '{nope' }), env())).toEqual({
      status: 400,
      body: { error: 'invalid_request' }
    });
    expect(p.calls).toHaveLength(0);
  });

  it('fichier texte renommé .jpg → 413 invalid_photo', async () => {
    const p = fakeProvider(sampleAnalysis());
    const r = await handleAnalyze(tdb.db, ctx, p, form({ photo: new Blob(['just text'], { type: 'image/jpeg' }) }), env());
    expect(r).toEqual({ status: 413, body: { error: 'invalid_photo' } });
    expect(p.calls).toHaveLength(0);
  });

  it("wineId d'un autre foyer → 404", async () => {
    const other = makeHousehold(tdb, 'Autre');
    const octx = { userId: makeUser(tdb, other), householdId: other, isAdmin: false };
    const id = mkWine(octx);
    const p = fakeProvider(sampleAnalysis());
    const r = await handleAnalyze(tdb.db, ctx, p, form({ wineId: String(id) }), env());
    expect(r.status).toBe(404);
    expect(p.calls).toHaveLength(0);
  });

  it('wineId sans photo → hints construits depuis la fiche, provider appelé sans image', async () => {
    const id = mkWine(ctx);
    const p = fakeProvider(sampleAnalysis());
    const r = await handleAnalyze(tdb.db, ctx, p, form({ wineId: String(id) }), env());
    expect(r.status).toBe(200);
    expect(p.calls[0].image).toBeNull();
    expect(p.calls[0].hints).toMatchObject({
      producer: 'Margaux', cuvee: 'Pavillon', appellation: 'Margaux', color: 'red', vintage: 2015, formatCl: 75, acquiredYear: 2020
    });
  });

  it('provider null → 200 ok:false not_configured', async () => {
    const r = await handleAnalyze(tdb.db, ctx, null, form({ hints: '{"producer":"X"}' }), env());
    expect(r).toMatchObject({ status: 200, body: { ok: false, error: 'not_configured' } });
  });

  it('hints : seules les clés connues de type correct sont gardées', () => {
    expect(parseHints('{"producer":"  Margaux ","vintage":2015,"color":"red","evil":"x","formatCl":"75","cuvee":5}')).toEqual({
      producer: 'Margaux', vintage: 2015, color: 'red'
    });
    expect(parseHints('[1]')).toBeNull();
    expect(parseHints('nope')).toBeNull();
    expect(parseHints(JSON.stringify({ producer: 'a'.repeat(201) }))).toEqual({});
  });
});

describe('POST /api/label/analyze', () => {
  it('sans session → 401 JSON', async () => {
    const res = await POST({
      request: new Request('http://x/api/label/analyze', { method: 'POST', body: new FormData() }),
      locals: { user: null }
    } as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });
});
