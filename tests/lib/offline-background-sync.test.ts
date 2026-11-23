import { describe, expect, it, vi } from 'vitest';
import {
  BACKGROUND_RETRY_DELAYS_MS,
  BACKGROUND_SYNC_BUDGET_MS,
  runWithRetries,
  shouldRetry
} from '$lib/offline/background-sync';
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

  it('onOutcome qui lève → les essais continuent, renvoie le dernier résultat', async () => {
    const syncOnce = script('retry', 'retry', 'ok');
    const onOutcome = vi.fn(() => {
      throw new Error('postMessage');
    });
    const res = await runWithRetries(syncOnce, onOutcome, BACKGROUND_RETRY_DELAYS_MS, async () => {});
    expect(syncOnce).toHaveBeenCalledTimes(3);
    expect(onOutcome).toHaveBeenCalledTimes(3);
    expect(res.status).toBe('ok');
  });

  it('onOutcome asynchrone qui rejette → les essais continuent', async () => {
    const syncOnce = script('retry', 'ok');
    const res = await runWithRetries(syncOnce, () => Promise.reject(new Error('matchAll')), BACKGROUND_RETRY_DELAYS_MS, async () => {});
    expect(syncOnce).toHaveBeenCalledTimes(2);
    expect(res.status).toBe('ok');
  });

  it('chaque essai coûte 20 s (fausse horloge) → la boucle s’arrête avant 150 s et renvoie le dernier résultat', async () => {
    let clock = 0;
    const now = () => clock;
    let calls = 0;
    const syncOnce = vi.fn(async () => {
      clock += 20_000;
      return { ...outcome('retry'), sent: ++calls };
    });
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    const res = await runWithRetries(syncOnce, () => {}, BACKGROUND_RETRY_DELAYS_MS, sleep, now);
    // 20 + 2 + 20 + 4 + 20 + 8 + 20 + 15 + 20 = 129 s; 129 + 30 > 150: no 6th attempt.
    expect(syncOnce).toHaveBeenCalledTimes(5);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 4000, 8000, 15000]);
    expect(clock).toBeLessThan(BACKGROUND_SYNC_BUDGET_MS);
    expect(res).toMatchObject({ status: 'retry', sent: 5 });
  });

  it('essais instantanés → tous les délais sont attendus (budget non atteint)', async () => {
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    await runWithRetries(script('retry'), () => {}, BACKGROUND_RETRY_DELAYS_MS, sleep, () => clock);
    expect(sleep).toHaveBeenCalledTimes(BACKGROUND_RETRY_DELAYS_MS.length);
  });
});

describe('shouldRetry', () => {
  it('vrai pour retry, offline, busy seulement', () => {
    const all: SyncStatus[] = ['ok', 'offline', 'retry', 'unauthorized', 'idle', 'busy'];
    expect(all.filter(shouldRetry)).toEqual(['offline', 'retry', 'busy']);
  });
});

describe('BACKGROUND_SYNC_BUDGET_MS', () => {
  it('vaut 150000', () => {
    expect(BACKGROUND_SYNC_BUDGET_MS).toBe(150_000);
  });
});

describe('BACKGROUND_RETRY_DELAYS_MS', () => {
  it('somme < 150000 (sous la limite de durée d’un événement sync)', () => {
    expect(BACKGROUND_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0)).toBeLessThan(150000);
  });
});
