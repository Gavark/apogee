import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db';
import { makeHousehold, makeUser, makeLocation } from '../helpers/fixtures';
import { createWine, type WineInput } from '../../src/lib/server/wines';
import { sweepOrphanPhotos, PHOTO_GRACE_MS } from '../../src/lib/server/photo-sweep';

const NOW = new Date('2026-11-23T15:00:00Z');
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const DAY = 24 * 3600;

let tdb: ReturnType<typeof makeTestDb>;
let dir: string;
let hid: number;
let log: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tdb = makeTestDb();
  dir = mkdtempSync(join(tmpdir(), 'apogee-sweep-'));
  hid = makeHousehold(tdb);
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function put(rel: string, ageDays: number): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, 'x');
  const t = new Date(NOW.getTime() - ageDays * DAY * 1000);
  utimesSync(full, t, t);
}

function mkWine(photo: string): number {
  const w: WineInput = {
    producer: 'Margaux', cuvee: null, appellation: null, region: null, country: null, color: 'red',
    vintage: 2015, grapes: null, formatCl: 75, acquiredYear: null,
    window: { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null },
    notes: null
  };
  const loc = makeLocation(tdb, hid, `Cave ${Math.random()}`);
  const ctx = { userId: makeUser(tdb, hid), householdId: hid, isAdmin: false };
  const { wineId } = createWine(tdb.db, ctx, w, { locationId: loc, position: '', quantity: 1 });
  tdb.db.update(tdb.schema.wines).set({ labelPhoto: photo }).where(eq(tdb.schema.wines.id, wineId)).run();
  return wineId;
}

function mkAnalysis(photoPath: string, createdAt: number): number {
  return tdb.db
    .insert(tdb.schema.labelAnalyses)
    .values({ householdId: hid, photoPath, createdAt })
    .returning({ id: tdb.schema.labelAnalyses.id })
    .get().id;
}

const analysisPath = (id: number) =>
  tdb.db.select().from(tdb.schema.labelAnalyses).where(eq(tdb.schema.labelAnalyses.id, id)).get()!.photoPath;

const uuidPath = (h = hid) => `${h}/${randomUUID()}.jpg`;

describe('sweepOrphanPhotos', () => {
  it('a un délai de grâce de 7 jours', () => {
    expect(PHOTO_GRACE_MS).toBe(7 * 24 * 3600 * 1000);
  });

  it('supprime une photo non référencée de plus de 7 jours et la journalise', () => {
    const kept = uuidPath();
    const orphan = uuidPath();
    put(kept, 30);
    put(orphan, 8);
    mkWine(kept);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([orphan]);
    expect(r.skipped).toBeNull();
    expect(existsSync(join(dir, orphan))).toBe(false);
    expect(existsSync(join(dir, kept))).toBe(true);
    expect(log).toHaveBeenCalledWith(`[photos] orphan removed: ${orphan}`);
    expect(log).toHaveBeenCalledWith('[photos] sweep: 1 removed, 0 recent kept');
  });

  it('garde une photo référencée par un vin, quel que soit son âge', () => {
    const p = uuidPath();
    put(p, 400);
    mkWine(p);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([]);
    expect(existsSync(join(dir, p))).toBe(true);
  });

  it('garde une photo non référencée de moins de 7 jours', () => {
    const wine = uuidPath();
    const recent = uuidPath();
    put(wine, 30);
    put(recent, 6);
    mkWine(wine);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([]);
    expect(r.keptRecent).toBe(1);
    expect(existsSync(join(dir, recent))).toBe(true);
  });

  it('garde une photo vieille mais citée par une analyse de moins de 7 jours', () => {
    const wine = uuidPath();
    const cited = uuidPath();
    put(wine, 30);
    put(cited, 30);
    mkWine(wine);
    mkAnalysis(cited, NOW_SEC - DAY);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([]);
    expect(r.keptRecent).toBe(1);
    expect(existsSync(join(dir, cited))).toBe(true);
  });

  it('remet à NULL photo_path des analyses (anciennes) de la photo supprimée', () => {
    const wine = uuidPath();
    const orphan = uuidPath();
    put(wine, 30);
    put(orphan, 30);
    mkWine(wine);
    const id = mkAnalysis(orphan, NOW_SEC - 20 * DAY);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([orphan]);
    expect(analysisPath(id)).toBeNull();
  });

  it('ignore ce qui ne ressemble pas à une photo stockée', () => {
    const wine = uuidPath();
    put(wine, 30);
    mkWine(wine);
    const odd = ['1/notes.txt', '1/abc.jpg', `x/${randomUUID()}.jpg`, `1/sub/${randomUUID()}.jpg`];
    for (const rel of odd) put(rel, 30);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([]);
    for (const rel of odd) expect(existsSync(join(dir, rel))).toBe(true);
  });

  it("ne supprime rien si aucun vin ne référence de photo alors qu'il y a des fichiers", () => {
    const p = uuidPath();
    put(p, 30);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.skipped).toBe('no_references');
    expect(r.removed).toEqual([]);
    expect(existsSync(join(dir, p))).toBe(true);
    expect(warn).toHaveBeenCalledWith('[photos] sweep skipped: no wine references a photo');
  });

  it('dossier photos absent : résultat vide, ne lève pas', () => {
    const r = sweepOrphanPhotos(tdb.db, join(dir, 'absent'), NOW);
    expect(r).toEqual({ removed: [], keptRecent: 0, skipped: null });
  });

  it("supprime aussi les photos d'un dossier de foyer qui n'existe plus", () => {
    const wine = uuidPath();
    const gone = `99/${randomUUID()}.jpg`;
    put(wine, 30);
    put(gone, 30);
    mkWine(wine);
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([gone]);
    expect(existsSync(join(dir, gone))).toBe(false);
  });

  it('ne laisse pas une erreur sur un fichier arrêter le ménage', () => {
    const wine = uuidPath();
    put(wine, 30);
    mkWine(wine);
    // A directory named like a photo is not a file: ignored, never an error.
    mkdirSync(join(dir, '1', `${randomUUID()}.jpg`), { recursive: true });
    const r = sweepOrphanPhotos(tdb.db, dir, NOW);
    expect(r.removed).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });
});
