import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import { fakeProvider, sampleAnalysis } from '../helpers/fake-ai';
import { analyzeAndStore, countAnalysesToday, getOwnedAnalysis } from '../../src/lib/server/label-analyses';
import { savePhoto } from '../../src/lib/server/photos';
import { createWine, deleteWine, type WineInput } from '../../src/lib/server/wines';
import { deleteHouseholdAsAdmin } from '../../src/lib/server/households';
import { loadWinePhoto } from '../../src/routes/app/wines/[id]/photo/_logic';
import { AiError } from '../../src/lib/server/ai/types';
import { NotFoundError, type HouseholdCtx } from '../../src/lib/server/context';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

let tdb: ReturnType<typeof makeTestDb>;
let dir: string;
let hid: number;
let ctx: HouseholdCtx;

beforeEach(() => {
  tdb = makeTestDb();
  dir = mkdtempSync(join(tmpdir(), 'apogee-photos-'));
  hid = makeHousehold(tdb);
  ctx = { userId: makeUser(tdb, hid), householdId: hid, isAdmin: false };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function input(over: Record<string, unknown> = {}) {
  return {
    photo: JPEG as Uint8Array | null,
    hints: null,
    locale: 'fr' as const,
    currentYear: 2026,
    timeZone: 'Europe/Paris',
    dailyLimit: 0,
    photosDir: dir,
    ...over
  };
}
const rows = () => tdb.db.select().from(tdb.schema.labelAnalyses).all();

function mkWine(c: HouseholdCtx, vintage = 2015, photo: string | null = null): number {
  const w: WineInput = {
    producer: 'Margaux', cuvee: null, appellation: null, region: null, country: null, color: 'red',
    vintage, grapes: null, formatCl: 75, acquiredYear: null,
    window: { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null },
    notes: null
  };
  const loc = makeLocation(tdb, c.householdId, `Cave ${Math.random()}`);
  const { wineId } = createWine(tdb.db, c, w, { locationId: loc, position: '', quantity: 1 });
  if (photo) tdb.db.update(tdb.schema.wines).set({ labelPhoto: photo }).where(eq(tdb.schema.wines.id, wineId)).run();
  return wineId;
}

describe('analyzeAndStore', () => {
  it("succès : ligne avec result + model, photo sur disque, provider appelé avec l'image", async () => {
    const p = fakeProvider(sampleAnalysis());
    const out = await analyzeAndStore(tdb.db, ctx, p, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.model).toBe('fake-model');
    expect(out.analysis.producer).toBe('Château Margaux');
    const [row] = rows();
    expect(row.id).toBe(out.analysisId);
    expect(row.householdId).toBe(hid);
    expect(row.userId).toBe(ctx.userId);
    expect(row.model).toBe('fake-model');
    expect(row.errorCode).toBeNull();
    expect(JSON.parse(row.result!).vintage).toBe(2015);
    expect(existsSync(join(dir, row.photoPath!))).toBe(true);
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0].image?.mimeType).toBe('image/jpeg');
    expect([...p.calls[0].image!.data]).toEqual([...JPEG]);
    expect(p.calls[0].locale).toBe('fr');
    expect(p.calls[0].currentYear).toBe(2026);
    expect(getOwnedAnalysis(tdb.db, ctx, out.analysisId).analysis?.appellation).toBe('Margaux');
  });

  it('photo invalide → invalid_photo, rien enregistré', async () => {
    const p = fakeProvider(sampleAnalysis());
    const out = await analyzeAndStore(tdb.db, ctx, p, input({ photo: new TextEncoder().encode('not an image') }));
    expect(out).toEqual({ ok: false, analysisId: null, error: 'invalid_photo' });
    expect(rows()).toHaveLength(0);
    expect(p.calls).toHaveLength(0);
  });

  it('échec de stockage (volume inutilisable) → unavailable, journalisé sans chemin, rien enregistré', async () => {
    const notADir = join(dir, 'file');
    writeFileSync(notADir, 'x');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const p = fakeProvider(sampleAnalysis());
      const out = await analyzeAndStore(tdb.db, ctx, p, input({ photosDir: notADir }));
      expect(out).toEqual({ ok: false, analysisId: null, error: 'unavailable' });
      expect(rows()).toHaveLength(0);
      expect(p.calls).toHaveLength(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls.flat().every((a) => !String(a).includes(dir))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("existingPhotoPath d'un autre foyer → traité comme sans photo", async () => {
    const other = makeHousehold(tdb, 'Autre');
    const { path } = savePhoto(dir, other, JPEG);
    const p = fakeProvider(sampleAnalysis());
    const out = await analyzeAndStore(tdb.db, ctx, p, input({ photo: null, existingPhotoPath: path }));
    expect(out.ok).toBe(true);
    expect(p.calls[0].image).toBeNull();
    expect(rows()[0].photoPath).toBeNull();
  });

  it('provider null → not_configured, photo conservée, analysisId utilisable', async () => {
    const out = await analyzeAndStore(tdb.db, ctx, null, input());
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toBe('not_configured');
    expect(out.analysisId).not.toBeNull();
    const got = getOwnedAnalysis(tdb.db, ctx, out.analysisId!);
    expect(got.analysis).toBeNull();
    expect(existsSync(join(dir, got.photoPath!))).toBe(true);
  });

  it('limite atteinte → limit_reached sans appel au provider ; les échecs ne comptent pas', async () => {
    const failing = fakeProvider(new AiError('unavailable'));
    await analyzeAndStore(tdb.db, ctx, failing, input({ dailyLimit: 1 }));
    await analyzeAndStore(tdb.db, ctx, failing, input({ dailyLimit: 1 }));
    expect(failing.calls).toHaveLength(2); // failures did not consume the limit

    const ok = fakeProvider(sampleAnalysis());
    expect((await analyzeAndStore(tdb.db, ctx, ok, input({ dailyLimit: 1 }))).ok).toBe(true);
    const out = await analyzeAndStore(tdb.db, ctx, ok, input({ dailyLimit: 1 }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toBe('limit_reached');
    expect(out.analysisId).not.toBeNull();
    expect(ok.calls).toHaveLength(1);
    expect(getOwnedAnalysis(tdb.db, ctx, out.analysisId!).photoPath).not.toBeNull();
    // dailyLimit 0 = unlimited
    expect((await analyzeAndStore(tdb.db, ctx, ok, input({ dailyLimit: 0 }))).ok).toBe(true);
  });

  it('AiError unavailable → ok:false error unavailable, ligne enregistrée', async () => {
    const out = await analyzeAndStore(tdb.db, ctx, fakeProvider(new AiError('unavailable')), input());
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toBe('unavailable');
    const row = rows().find((r) => r.id === out.analysisId)!;
    expect(row.errorCode).toBe('unavailable');
    expect(row.result).toBeNull();
    expect(row.photoPath).not.toBeNull();
  });

  it('une erreur inattendue du provider → unavailable, sans lever', async () => {
    const p = fakeProvider(sampleAnalysis());
    p.analyzeLabel = async () => {
      throw new TypeError('boom');
    };
    const out = await analyzeAndStore(tdb.db, ctx, p, input());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('unavailable');
  });

  it('existingPhotoPath : relit la photo sans la recopier', async () => {
    const { path } = savePhoto(dir, hid, JPEG);
    const p = fakeProvider(sampleAnalysis());
    const out = await analyzeAndStore(tdb.db, ctx, p, input({ photo: null, existingPhotoPath: path }));
    expect(out.ok).toBe(true);
    expect(p.calls[0].image?.mimeType).toBe('image/jpeg');
    expect(rows()[0].photoPath).toBe(path);
  });

  it('sans photo : analyse à partir des indices seuls', async () => {
    const p = fakeProvider(sampleAnalysis());
    const out = await analyzeAndStore(tdb.db, ctx, p, input({ photo: null, hints: { producer: 'X' } }));
    expect(out.ok).toBe(true);
    expect(p.calls[0].image).toBeNull();
    expect(rows()[0].photoPath).toBeNull();
  });
});

describe('countAnalysesToday', () => {
  it('suit le fuseau (23h30 UTC le 31/12 = lendemain à Paris)', () => {
    const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);
    const ok = (iso: string) =>
      tdb.db.insert(tdb.schema.labelAnalyses).values({ householdId: hid, result: '{}', createdAt: ts(iso) }).run();
    ok('2026-12-31T22:30:00Z'); // 23:30 Paris, 31/12
    ok('2026-12-31T23:10:00Z'); // 00:10 Paris, 01/01
    ok('2026-12-31T23:20:00Z'); // 00:20 Paris, 01/01
    // failure rows never count
    tdb.db
      .insert(tdb.schema.labelAnalyses)
      .values({ householdId: hid, errorCode: 'unavailable', createdAt: ts('2026-12-31T23:25:00Z') })
      .run();
    const now = new Date('2026-12-31T23:30:00Z');
    expect(countAnalysesToday(tdb.db, hid, 'Europe/Paris', now)).toBe(2);
    expect(countAnalysesToday(tdb.db, hid, 'UTC', now)).toBe(3);
    expect(countAnalysesToday(tdb.db, hid + 1, 'Europe/Paris', now)).toBe(0);
  });
});

describe('countAnalysesToday : changements d heure', () => {
  const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const ok = (iso: string) =>
    tdb.db.insert(tdb.schema.labelAnalyses).values({ householdId: hid, result: '{}', createdAt: ts(iso) }).run();

  it('Paris, 29/03/2026 (heure d ete) : minuit local = 23:00Z la veille', () => {
    ok('2026-03-28T22:30:00Z'); // 23:30 on the 28th: not today
    ok('2026-03-28T23:30:00Z'); // 00:30 on the 29th
    expect(countAnalysesToday(tdb.db, hid, 'Europe/Paris', new Date('2026-03-29T12:00:00Z'))).toBe(1);
  });

  it('Paris, 25/10/2026 (heure d hiver) : minuit local = 22:00Z la veille', () => {
    ok('2026-10-24T21:30:00Z'); // 23:30 on the 24th: not today
    ok('2026-10-24T22:30:00Z'); // 00:30 on the 25th
    expect(countAnalysesToday(tdb.db, hid, 'Europe/Paris', new Date('2026-10-25T12:00:00Z'))).toBe(1);
  });
});

describe('getOwnedAnalysis', () => {
  it("d'un autre foyer → NotFoundError", async () => {
    const out = await analyzeAndStore(tdb.db, ctx, fakeProvider(sampleAnalysis()), input());
    const other = makeHousehold(tdb, 'Autre');
    const otherCtx = { userId: makeUser(tdb, other), householdId: other, isAdmin: false };
    expect(() => getOwnedAnalysis(tdb.db, otherCtx, out.analysisId!)).toThrow(NotFoundError);
    expect(() => getOwnedAnalysis(tdb.db, ctx, 9999)).toThrow(NotFoundError);
  });
});

describe('suppression', () => {
  it('deleteWine supprime la photo du disque, sauf si un autre vin la référence', () => {
    const { path } = savePhoto(dir, hid, JPEG);
    const w1 = mkWine(ctx, 2015, path);
    const w2 = mkWine(ctx, 2016, path);
    deleteWine(tdb.db, ctx, w1, dir);
    expect(existsSync(join(dir, path))).toBe(true);
    deleteWine(tdb.db, ctx, w2, dir);
    expect(existsSync(join(dir, path))).toBe(false);
  });

  it('deleteWine avec fichier déjà absent ne lève pas', () => {
    const w = mkWine(ctx, 2015, '1/00000000-0000-0000-0000-000000000000.jpg');
    expect(() => deleteWine(tdb.db, ctx, w, dir)).not.toThrow();
  });

  it("une erreur de suppression autre qu'ENOENT est journalisée, pas levée (la suppression a abouti)", () => {
    const rel = '1/00000000-0000-0000-0000-000000000001.jpg';
    // a non-empty directory at the photo path makes rmSync fail with something other than ENOENT
    mkdirSync(join(dir, rel), { recursive: true });
    writeFileSync(join(dir, rel, 'x'), 'x');
    const w = mkWine(ctx, 2015, rel);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => deleteWine(tdb.db, ctx, w, dir)).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(tdb.db.select().from(tdb.schema.wines).where(eq(tdb.schema.wines.id, w)).all()).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('deleteHouseholdAsAdmin supprime le dossier du foyer', () => {
    const other = makeHousehold(tdb, 'À supprimer');
    const { path } = savePhoto(dir, other, JPEG);
    const admin = { userId: makeUser(tdb, hid, { isAdmin: true }), householdId: hid, isAdmin: true };
    expect(deleteHouseholdAsAdmin(tdb.db, admin, other, dir)).toEqual({ ok: true });
    expect(existsSync(join(dir, path))).toBe(false);
    expect(existsSync(join(dir, String(other)))).toBe(false);
  });
});

describe('loadWinePhoto (route photo)', () => {
  it('200 avec le bon type pour le foyer, null (404) pour un autre foyer, sans photo ou chemin dangereux', () => {
    const { path } = savePhoto(dir, hid, JPEG);
    const w = mkWine(ctx, 2015, path);
    const noPhoto = mkWine(ctx, 2016);

    const r = loadWinePhoto(tdb.db, ctx, w, dir);
    expect(r?.mime).toBe('image/jpeg');
    expect([...r!.bytes]).toEqual([...JPEG]);

    expect(loadWinePhoto(tdb.db, ctx, noPhoto, dir)).toBeNull();
    expect(loadWinePhoto(tdb.db, ctx, 9999, dir)).toBeNull();
    const other = makeHousehold(tdb, 'Autre');
    const otherCtx = { userId: makeUser(tdb, other), householdId: other, isAdmin: false };
    expect(loadWinePhoto(tdb.db, otherCtx, w, dir)).toBeNull();

    // a path pointing into another household folder is refused too
    const other2 = makeHousehold(tdb, 'Autre 2');
    const foreign = savePhoto(dir, other2, JPEG).path;
    tdb.db.update(tdb.schema.wines).set({ labelPhoto: foreign }).where(eq(tdb.schema.wines.id, w)).run();
    expect(loadWinePhoto(tdb.db, ctx, w, dir)).toBeNull();

    tdb.db.update(tdb.schema.wines).set({ labelPhoto: '../../etc/passwd' }).where(eq(tdb.schema.wines.id, w)).run();
    expect(loadWinePhoto(tdb.db, ctx, w, dir)).toBeNull();
  });
});
