import type { AiProvider } from './types';
import { createAnthropicProvider } from './anthropic';
import { createOpenAiCompatibleProvider } from './openai-compatible';

export type AiConfig =
  | { provider: 'none' }
  | { provider: 'anthropic'; apiKey: string; model: string }
  | { provider: 'openai-compatible'; apiKey: string | null; model: string; baseUrl: string };

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
const DEFAULT_DAILY_LIMIT = 100;

type Env = Record<string, string | undefined>;

let warned = false;
/** Logs once, never the value of any variable. */
function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[ai] ${message}`);
}

function clean(v: string | undefined): string {
  return (v ?? '').trim();
}

export function readAiConfig(env: Env): AiConfig {
  const key = clean(env.AI_API_KEY);
  const model = clean(env.AI_MODEL);
  const explicit = clean(env.AI_PROVIDER).toLowerCase();
  const provider = explicit || (key ? 'anthropic' : 'none');

  if (provider === 'anthropic') {
    if (!key) return { provider: 'none' };
    return { provider: 'anthropic', apiKey: key, model: model || DEFAULT_ANTHROPIC_MODEL };
  }

  if (provider === 'openai-compatible') {
    const rawUrl = clean(env.AI_BASE_URL);
    let valid = false;
    try {
      const u = new URL(rawUrl);
      valid = (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password;
    } catch {
      valid = false;
    }
    if (!valid || !model) {
      warnOnce('AI_PROVIDER=openai-compatible requires a valid http(s) AI_BASE_URL without credentials, and AI_MODEL; AI disabled.');
      return { provider: 'none' };
    }
    return {
      provider: 'openai-compatible',
      apiKey: key || null,
      model,
      baseUrl: rawUrl.replace(/\/+$/, '')
    };
  }

  if (provider !== 'none') warnOnce('Unknown AI_PROVIDER; AI disabled.');
  return { provider: 'none' };
}

/** Daily analyses per household. 0 = unlimited. */
export function aiDailyLimit(env: Env): number {
  const raw = clean(env.AI_DAILY_LIMIT_PER_HOUSEHOLD);
  if (!/^\d+$/.test(raw)) return DEFAULT_DAILY_LIMIT;
  return Number.parseInt(raw, 10);
}

export function describeAiConfig(cfg: AiConfig): {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  configured: boolean;
} {
  if (cfg.provider === 'none') return { provider: 'none', model: null, baseUrl: null, configured: false };
  return {
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.provider === 'openai-compatible' ? cfg.baseUrl : null,
    configured: true
  };
}

let cached: { provider: AiProvider | null } | undefined;

export function getAiProvider(): AiProvider | null {
  if (cached) return cached.provider;
  const cfg = readAiConfig(process.env);
  let provider: AiProvider | null = null;
  if (cfg.provider === 'anthropic') provider = createAnthropicProvider(cfg);
  else if (cfg.provider === 'openai-compatible') provider = createOpenAiCompatibleProvider(cfg);
  cached = { provider };
  return provider;
}

export function _resetAiProviderForTests(): void {
  cached = undefined;
  warned = false;
}
