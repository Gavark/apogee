import { describe, expect, it, vi } from 'vitest';
import { BACKGROUND_RETRY_DELAYS_MS, runWithRetries, shouldRetry } from '$lib/offline/background-sync';
import type { SyncOutcome, SyncStatus } from '$lib/offline/sync';

const outcome = (status: SyncStatus): SyncOutcome => ({ sent: 0, results: [], dropped: [], undone: [], quarantined: [], status });

/** A syncOnce answering the given statuses in order (the last one repeats). */
function script(...statuses: SyncStatus[]) {
  let i = 0;
  return vi.fn(async () => outcome(statuses[Math.min(i++, statuses.length - 1)]));
}

describe('runWithRetries', () => {
  it('succès au 3e essai → 3 appels, sleeps [2000, 4000], renvoie ok', async () => {
    const syncOnce = script('retry', 'retry', 'ok');
    const sleep = vi.fn(async (_ms: number) => {});
    const res = await runWithRetries(syncOnce, () => {}, BACKGROUND_RETRY_DELAYS_MS, sleep);
    expect(syncOnce).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 4000]);
    expect(res.status).toBe('ok');
  });

  it.each(['idle', 'unauthorized'] as const)('%s au 1er essai → 1 appel, aucun sleep', async (status) => {
    const syncOnce = script(status);
    const sleep = vi.fn(async (_ms: number) => {});
    const res = await runWithRetries(syncOnce, () => {}, BACKGROUND_RETRY_DELAYS_MS, sleep);
    expect(syncOnce).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(res.status).toBe(status);
  });

  it('retry à chaque fois → 7 appels, sleeps égaux à BACKGROUND_RETRY_DELAYS_MS, renvoie retry', async () => {
    const syncOnce = script('retry');
    const sleep = vi.fn(async (_ms: number) => {});
    const res = await runWithRetries(syncOnce, () => {}, BACKGROUND_RETRY_DELAYS_MS, sleep);
    expect(syncOnce).toHaveBeenCalledTimes(7);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([...BACKGROUND_RETRY_DELAYS_MS]);
    expect(res.status).toBe('retry');
  });

  it('offline puis busy puis ok → 3 appels', async () => {
    const syncOnce = script('offline', 'busy', 'ok');
    const res = await runWithRetries(syncOnce, () => {}, BACKGROUND_RETRY_DELAYS_MS, async () => {});
    expect(syncOnce).toHaveBeenCalledTimes(3);
    expect(res.status).toBe('ok');
  });

  it('onOutcome reçoit chaque résultat, dans l’ordre', async () => {
    const seen: SyncStatus[] = [];
    await runWithRetries(script('offline', 'busy', 'ok'), (o) => void seen.push(o.status), BACKGROUND_RETRY_DELAYS_MS, async () => {});
    expect(seen).toEqual(['offline', 'busy', 'ok']);
  });
});

describe('shouldRetry', () => {
  it('vrai pour retry, offline, busy seulement', () => {
    const all: SyncStatus[] = ['ok', 'offline', 'retry', 'unauthorized', 'idle', 'busy'];
    expect(all.filter(shouldRetry)).toEqual(['offline', 'retry', 'busy']);
  });
});

describe('BACKGROUND_RETRY_DELAYS_MS', () => {
  it('somme < 150000 (sous la limite de durée d’un événement sync)', () => {
    expect(BACKGROUND_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0)).toBeLessThan(150000);
  });
});
