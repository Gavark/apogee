import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

const EXT: Record<PhotoMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME_BY_EXT: Record<string, PhotoMime> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const SAFE_REL_PATH = /^\d+\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function photosDir(): string {
  return process.env.PHOTOS_DIR ?? join(dirname(process.env.DATABASE_PATH ?? './data/apogee.sqlite'), 'photos');
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);
}

/** Identifies the image type from its magic bytes (never from a name or a client-sent type). */
export function sniffImage(bytes: Uint8Array): PhotoMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return 'image/webp';
  return null;
}

export function isSafeRelPath(relPath: string): boolean {
  return SAFE_REL_PATH.test(relPath);
}

/** A safe stored path that lives in the given household folder. */
export function isHouseholdPhotoPath(relPath: string, householdId: number): boolean {
  return isSafeRelPath(relPath) && relPath.startsWith(`${householdId}/`);
}

/** Runs a cleanup after a committed delete: a failure is logged (error code only), never thrown. */
export function cleanupQuietly(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    console.error('photo cleanup failed:', typeof code === 'string' ? code : 'unknown');
  }
}

/** Writes the photo under `<dir>/<householdId>/<uuid>.<ext>`. Throws RangeError when too big or not an image. */
export function savePhoto(
  dir: string,
  householdId: number,
  bytes: Uint8Array
): { path: string; mime: PhotoMime } {
  if (bytes.length > MAX_PHOTO_BYTES) throw new RangeError('photo too large');
  const mime = sniffImage(bytes);
  if (!mime) throw new RangeError('unsupported image type');
  const path = `${householdId}/${randomUUID()}.${EXT[mime]}`;
  mkdirSync(join(dir, String(householdId)), { recursive: true });
  writeFileSync(join(dir, path), bytes);
  return { path, mime };
}

export function readPhoto(dir: string, relPath: string): { bytes: Buffer; mime: PhotoMime } | null {
  if (!isSafeRelPath(relPath)) return null;
  try {
    const bytes = readFileSync(join(dir, relPath));
    const mime = MIME_BY_EXT[relPath.slice(relPath.lastIndexOf('.') + 1)];
    return { bytes, mime };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** Silent when the file is absent or the path is not a stored photo path. */
export function deletePhoto(dir: string, relPath: string | null): void {
  if (!relPath || !isSafeRelPath(relPath)) return;
  rmSync(join(dir, relPath), { force: true });
}

export function deleteHouseholdPhotos(dir: string, householdId: number): void {
  rmSync(join(dir, String(householdId)), { recursive: true, force: true });
}
