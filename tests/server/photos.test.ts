import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_PHOTO_BYTES,
  sniffImage,
  savePhoto,
  readPhoto,
  deletePhoto,
  deleteHouseholdPhotos,
  isSafeRelPath,
  photosDir
} from '../../src/lib/server/photos';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9, 0x57, 0x45, 0x42, 0x50, 1]);
const GIF = new TextEncoder().encode('GIF89a-----');

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'apogee-photos-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('photos', () => {
  it('sniffImage reconnaît JPEG/PNG/WebP, refuse un GIF et un texte', () => {
    expect(sniffImage(JPEG)).toBe('image/jpeg');
    expect(sniffImage(PNG)).toBe('image/png');
    expect(sniffImage(WEBP)).toBe('image/webp');
    expect(sniffImage(GIF)).toBeNull();
    expect(sniffImage(new TextEncoder().encode('hello world'))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    // RIFF but not WEBP (e.g. WAV)
    expect(sniffImage(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });

  it('savePhoto écrit <hid>/<uuid>.jpg et refuse > 5 Mo ou type inconnu', () => {
    const { path, mime } = savePhoto(dir, 7, JPEG);
    expect(mime).toBe('image/jpeg');
    expect(path).toMatch(/^7\/[0-9a-f-]{36}\.jpg$/);
    expect(isSafeRelPath(path)).toBe(true);
    expect([...readFileSync(join(dir, path))]).toEqual([...JPEG]);
    expect(savePhoto(dir, 7, PNG).path).toMatch(/\.png$/);
    expect(savePhoto(dir, 7, WEBP).path).toMatch(/\.webp$/);

    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(JPEG);
    expect(() => savePhoto(dir, 7, big)).toThrow(RangeError);
    expect(() => savePhoto(dir, 7, GIF)).toThrow(RangeError);
  });

  it('readPhoto relit les octets et le type ; chemin dangereux ou absent → null', () => {
    const { path } = savePhoto(dir, 1, PNG);
    const r = readPhoto(dir, path);
    expect(r?.mime).toBe('image/png');
    expect([...r!.bytes]).toEqual([...PNG]);
    expect(readPhoto(dir, '1/00000000-0000-0000-0000-000000000000.png')).toBeNull();
    expect(readPhoto(dir, '../1/x.jpg')).toBeNull();
  });

  it('readPhoto : erreur autre qu’ENOENT (EISDIR) → null, journalisée sans chemin', () => {
    const rel = '1/22222222-2222-4222-8222-222222222222.jpg';
    mkdirSync(join(dir, rel), { recursive: true });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(readPhoto(dir, rel)).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls.flat().every((a) => !String(a).includes(dir))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('isSafeRelPath refuse "../1/x.jpg", "1/../../etc", un chemin absolu', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(isSafeRelPath(`1/${uuid}.jpg`)).toBe(true);
    expect(isSafeRelPath('../1/x.jpg')).toBe(false);
    expect(isSafeRelPath('1/../../etc')).toBe(false);
    expect(isSafeRelPath(`/1/${uuid}.jpg`)).toBe(false);
    expect(isSafeRelPath(`C:\\1\\${uuid}.jpg`)).toBe(false);
    expect(isSafeRelPath(`1/${uuid}.gif`)).toBe(false);
    expect(isSafeRelPath(`1/${uuid}.jpg\n`)).toBe(false);
  });

  it("deletePhoto et deleteHouseholdPhotos suppriment ; absent → pas d'erreur", () => {
    const a = savePhoto(dir, 3, JPEG);
    deletePhoto(dir, a.path);
    expect(existsSync(join(dir, a.path))).toBe(false);
    expect(() => deletePhoto(dir, a.path)).not.toThrow();
    expect(() => deletePhoto(dir, null)).not.toThrow();
    expect(() => deletePhoto(dir, '../evil')).not.toThrow();

    const b = savePhoto(dir, 4, JPEG);
    const c = savePhoto(dir, 5, JPEG);
    deleteHouseholdPhotos(dir, 4);
    expect(existsSync(join(dir, b.path))).toBe(false);
    expect(existsSync(join(dir, c.path))).toBe(true);
    expect(() => deleteHouseholdPhotos(dir, 99)).not.toThrow();
  });

  it('photosDir : PHOTOS_DIR sinon à côté de la base', () => {
    const saved = { p: process.env.PHOTOS_DIR, d: process.env.DATABASE_PATH };
    try {
      process.env.PHOTOS_DIR = '/x/photos';
      expect(photosDir()).toBe('/x/photos');
      delete process.env.PHOTOS_DIR;
      process.env.DATABASE_PATH = join('/data', 'apogee.sqlite');
      expect(photosDir()).toBe(join('/data', 'photos'));
    } finally {
      if (saved.p === undefined) delete process.env.PHOTOS_DIR;
      else process.env.PHOTOS_DIR = saved.p;
      if (saved.d === undefined) delete process.env.DATABASE_PATH;
      else process.env.DATABASE_PATH = saved.d;
    }
  });
});
