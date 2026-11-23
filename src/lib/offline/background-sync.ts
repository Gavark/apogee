// Framework-free (no $app/*, no runes): the service worker imports this module.
import type { SyncOutcome, SyncStatus } from './sync';

/**
 * Waits between the attempts made inside one `sync` event. Their sum (119 s) stays under the
 * time a browser lets a `sync` event run; BACKGROUND_SYNC_BUDGET_MS also counts the attempts.
 */
export const BACKGROUND_RETRY_DELAYS_MS: readonly number[] = [2000, 4000, 8000, 15000, 30000, 60000];

/**
 * Overall deadline of the attempts inside one `sync` event. Each attempt may also take up to 15 s
 * of request plus 5 s of /healthz probe, so the waits alone do not bound the event: no new attempt
 * is scheduled once the time spent plus the next wait would pass this budget (Chrome stops a `sync`
 * event after about 3 minutes).
 */
export const BACKGROUND_SYNC_BUDGET_MS = 150_000;

/** Statuses worth another attempt: the network may still be settling, or a tab holds the lock. */
export function shouldRetry(status: SyncStatus): boolean {
  return status === 'retry' || status === 'offline' || status === 'busy';
}

/**
 * Runs `syncOnce`, hands every outcome to `onOutcome`, and tries again after `delays[i]` while the
 * outcome is worth a retry. At most `delays.length + 1` attempts, and none whose wait would end past
 * BACKGROUND_SYNC_BUDGET_MS after the start (measured with `now`); returns the last outcome. A
 * failing `onOutcome` (telling the open windows) does not stop the attempts.
 */
export async function runWithRetries(
  syncOnce: () => Promise<SyncOutcome>,
  onOutcome: (outcome: SyncOutcome) => void | Promise<void>,
  delays: readonly number[] = BACKGROUND_RETRY_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => number = Date.now
): Promise<SyncOutcome> {
  const start = now();
  for (let i = 0; ; i++) {
    const outcome = await syncOnce();
    try {
      await onOutcome(outcome);
    } catch {
      // Only the windows miss this outcome: they reload their data at the next one anyway.
    }
    if (!shouldRetry(outcome.status) || i >= delays.length) return outcome;
    if (now() - start + delays[i] > BACKGROUND_SYNC_BUDGET_MS) return outcome;
    await sleep(delays[i]);
  }
}
