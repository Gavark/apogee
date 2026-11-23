// Framework-free (no $app/*, no runes): the service worker imports this module.
import type { SyncOutcome, SyncStatus } from './sync';

/**
 * Waits between the attempts made inside one `sync` event. Their sum (119 s) stays under the
 * time a browser lets a `sync` event run, so the event can finish on its own.
 */
export const BACKGROUND_RETRY_DELAYS_MS: readonly number[] = [2000, 4000, 8000, 15000, 30000, 60000];

/** Statuses worth another attempt: the network may still be settling, or a tab holds the lock. */
export function shouldRetry(status: SyncStatus): boolean {
  return status === 'retry' || status === 'offline' || status === 'busy';
}

/**
 * Runs `syncOnce`, hands every outcome to `onOutcome`, and tries again after `delays[i]` while the
 * outcome is worth a retry. At most `delays.length + 1` attempts; returns the last outcome.
 */
export async function runWithRetries(
  syncOnce: () => Promise<SyncOutcome>,
  onOutcome: (outcome: SyncOutcome) => void | Promise<void>,
  delays: readonly number[] = BACKGROUND_RETRY_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<SyncOutcome> {
  for (let i = 0; ; i++) {
    const outcome = await syncOnce();
    await onOutcome(outcome);
    if (!shouldRetry(outcome.status) || i >= delays.length) return outcome;
    await sleep(delays[i]);
  }
}
