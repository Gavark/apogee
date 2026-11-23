import type { ReviewRef } from '$lib/verdict';
import type { Verdict } from '$lib/stock-ops';

/**
 * The verdict sheet request, shown by <VerdictSheet /> (mounted once in the root
 * layout, like the toast). `onclosed` runs once when the sheet goes away, whatever the reason.
 */
export type VerdictRequest = {
  title: string;
  ref: ReviewRef;
  verdict: Verdict | null;
  note: string | null;
  onclosed?: () => void;
};

export const verdictSheet = $state<{ current: VerdictRequest | null }>({ current: null });

export function askVerdict(req: VerdictRequest): void {
  // A new request replaces the current one: settle the old one first.
  closeVerdict();
  verdictSheet.current = req;
}

export function closeVerdict(): void {
  const req = verdictSheet.current;
  if (!req) return;
  verdictSheet.current = null;
  req.onclosed?.();
}
