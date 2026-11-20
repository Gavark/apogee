import { error } from '@sveltejs/kit';
import { NotFoundError } from './context';

/** A route id: digits only and at least 1, otherwise 404 (same as an id that does not exist). */
export function parseRouteId(raw: string): number {
  if (!/^\d+$/.test(raw)) throw error(404);
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw error(404);
  return id;
}

/** Runs `fn`, turning NotFoundError (missing or foreign row) into a 404. */
export function orNotFound<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof NotFoundError) throw error(404);
    throw e;
  }
}
