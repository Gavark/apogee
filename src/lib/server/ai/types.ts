import type { WindowYears } from '$lib/phase';
import type { Color } from '$lib/server/wines';

export type AiConfidence = 'low' | 'medium' | 'high';

export type LabelAnalysis = {
  isWineLabel: boolean;
  producer: string | null;
  cuvee: string | null;
  appellation: string | null;
  region: string | null;
  country: string | null;
  color: Color | null;
  vintage: number | null;
  grapes: string | null;
  formatCl: number | null;
  /** All null when invalid or when !isWineLabel. */
  window: WindowYears;
  confidence: AiConfidence | null;
  /** At most 600 characters. */
  rationale: string | null;
};

export type LabelHints = {
  producer?: string | null;
  cuvee?: string | null;
  appellation?: string | null;
  color?: Color | null;
  vintage?: number | null;
  formatCl?: number | null;
  acquiredYear?: number | null;
};

export type AnalyzeInput = {
  image: { data: Uint8Array; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } | null;
  hints: LabelHints | null;
  locale: 'fr' | 'en';
  currentYear: number;
};

export type AiErrorCode =
  | 'not_configured'
  | 'auth'
  | 'rate_limited'
  | 'refused'
  | 'invalid_response'
  | 'unavailable';

/** Never put secrets (API keys, headers) in the message. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;

  constructor(code: AiErrorCode, status?: number) {
    super(status === undefined ? `AI error: ${code}` : `AI error: ${code} (HTTP ${status})`);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, AiError.prototype);
  }
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** Throws AiError. */
  analyzeLabel(input: AnalyzeInput): Promise<LabelAnalysis>;
}
