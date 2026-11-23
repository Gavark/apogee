import { readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, gte, isNotNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './db/schema';
import { labelAnalyses, wines } from './db/schema';
import { isSafeRelPath } from './photos';
import { zonedParts } from './timezone';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** A photo younger than this (file mtime, or cited by a recent analysis) is never swept. */
export const PHOTO_GRACE_MS = 7 * 24 * 3600 * 1000;

export type SweepResult = { removed: string[]; keptRecent: number; skipped: 'no_references' | null };

function errCode(e: unknown): string {
  const code = (e as NodeJS.ErrnoException).code;
  return typeof code === 'string' ? code : 'unknown';
}

/** Stored photos on disk: `<dir>/<n>/<uuid>.<ext>`, regular files only (links and folders ignored). */
function listCandidates(dir: string): string[] {
  const out: string[] = [];
  let households;
  try {
    households = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (errCode(e) !== 'ENOENT') console.error('[photos] sweep failed to list photos:', errCode(e));
    return out;
  }
  for (const h of households) {
    if (!h.isDirectory() || !/^\d+$/.test(h.name)) continue;
    let files;
    try {
      files = readdirSync(join(dir, h.name), { withFileTypes: true });
    } catch (e) {
      console.error('[photos] sweep failed to list photos:', errCode(e));
      continue;
    }
    for (const f of files) {
      const rel = `${h.name}/${f.name}`;
      if (f.isFile() && isSafeRelPath(rel)) out.push(rel);
    }
  }
  return out;
}

/**
 * Deletes label photos that no wine references, once past the grace period. Fully synchronous so no
 * query can slip in between the reference snapshot and the deletions.
 */
export function sweepOrphanPhotos(db: DB, dir: string, now: Date): SweepResult {
  const result: SweepResult = { removed: [], keptRecent: 0, skipped: null };
  const candidates = listCandidates(dir);
  if (candidates.length === 0) return result;

  const winePaths = new Set(
    db.selectDistinct({ p: wines.labelPhoto }).from(wines).where(isNotNull(wines.labelPhoto)).all().map((r) => r.p!)
  );
  if (winePaths.size === 0) {
    console.warn('[photos] sweep skipped: no wine references a photo');
    result.skipped = 'no_references';
    return result;
  }
  const sinceSec = Math.floor((now.getTime() - PHOTO_GRACE_MS) / 1000);
  const recentAnalysisPaths = new Set(
    db
      .selectDistinct({ p: labelAnalyses.photoPath })
      .from(labelAnalyses)
      .where(and(isNotNull(labelAnalyses.photoPath), gte(labelAnalyses.createdAt, sinceSec)))
      .all()
      .map((r) => r.p!)
  );

  for (const rel of candidates) {
    if (winePaths.has(rel)) continue;
    try {
      const full = join(dir, rel);
      if (now.getTime() - statSync(full).mtimeMs < PHOTO_GRACE_MS || recentAnalysisPaths.has(rel)) {
        result.keptRecent++;
        continue;
      }
      rmSync(full, { force: true });
      result.removed.push(rel);
      console.log(`[photos] orphan removed: ${rel}`);
      try {
        db.update(labelAnalyses).set({ photoPath: null }).where(eq(labelAnalyses.photoPath, rel)).run();
      } catch (e) {
        console.error('[photos] sweep could not clear analyses:', errCode(e));
      }
    } catch (e) {
      console.error('[photos] sweep failed on a file:', errCode(e));
    }
  }
  if (result.removed.length > 0 || result.keptRecent > 0) {
    console.log(`[photos] sweep: ${result.removed.length} removed, ${result.keptRecent} recent kept`);
  }
  return result;
}

/** Local hour (instance time zone) from which the daily sweep may run. */
export const SWEEP_HOUR = 14;

let lastSweepDate: string | null = null;

/** Runs the sweep on the first pass of a local day at or after SWEEP_HOUR; null otherwise. */
export function runPhotoSweepTick(db: DB, now: Date, dir: string, timeZone: string): SweepResult | null {
  const { y, mo, d, h } = zonedParts(now.getTime(), timeZone);
  if (h < SWEEP_HOUR) return null;
  const date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (date === lastSweepDate) return null;
  // Marked before sweeping: a failing sweep must not retry every 10 minutes the same day.
  lastSweepDate = date;
  return sweepOrphanPhotos(db, dir, now);
}

/** Tests only. */
export function resetPhotoSweepTick(): void {
  lastSweepDate = null;
}
