import { goto } from '$app/navigation';
import type { LabelHints } from '$lib/server/ai/types';
import type { AnalysisOutcome } from '$lib/server/label-analyses';
import { SessionExpiredError } from '$lib/stock-client';

/** Posts a label photo and/or hints (or a wineId to re-estimate). Rejects on network/HTTP failure other than the 413 outcome. */
export async function analyzeLabel(args: { photo?: Blob; hints?: LabelHints; wineId?: number }): Promise<AnalysisOutcome> {
  const form = new FormData();
  if (args.photo) form.append('photo', args.photo, 'label.jpg');
  if (args.hints) form.append('hints', JSON.stringify(args.hints));
  if (args.wineId !== undefined) form.append('wineId', String(args.wineId));
  const res = await fetch('/api/label/analyze', { method: 'POST', body: form });
  if (res.status === 401) {
    await goto('/login');
    throw new SessionExpiredError();
  }
  if (res.status === 413) return { ok: false, analysisId: null, error: 'invalid_photo' };
  if (!res.ok) throw new Error(`label analysis failed: HTTP ${res.status}`);
  return (await res.json()) as AnalysisOutcome;
}

/** The photo never reached storage (network/HTTP/storage failure): nothing was kept, so it must not look attached. */
export const isLostUpload = (o: AnalysisOutcome): boolean =>
  !o.ok && o.analysisId === null && o.error !== 'invalid_photo';
