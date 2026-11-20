import { and, gte, isNotNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '$lib/server/db/schema';
import { aiDailyLimit, describeAiConfig, readAiConfig } from '$lib/server/ai/config';
import { AiError, type AiErrorCode, type AiProvider } from '$lib/server/ai/types';

type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
type Env = Record<string, string | undefined>;

export type AiStatus = {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  configured: boolean;
  dailyLimit: number;
  analysesToday: number;
};

/** Instance-wide state of the AI feature. Never includes the API key, nor any per-household detail. */
export function aiStatus(db: DB, env: Env, now: Date = new Date()): AiStatus {
  const startOfUtcDay = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
  const { n } = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.labelAnalyses)
    .where(and(isNotNull(schema.labelAnalyses.result), gte(schema.labelAnalyses.createdAt, startOfUtcDay)))
    .get()!;
  return { ...describeAiConfig(readAiConfig(env)), dailyLimit: aiDailyLimit(env), analysesToday: n };
}

export type AiTestResult = { ok: true; model: string; ms: number } | { ok: false; error: AiErrorCode };

/** One image-less call with fixed hints. Touches no database: nothing is stored, no quota is used. */
export async function testAiProvider(provider: AiProvider | null): Promise<AiTestResult> {
  if (!provider) return { ok: false, error: 'not_configured' };
  const started = performance.now();
  try {
    await provider.analyzeLabel({
      image: null,
      hints: { producer: 'Château Margaux', appellation: 'Margaux', color: 'red', vintage: 2015 },
      locale: 'fr',
      currentYear: new Date().getFullYear()
    });
    return { ok: true, model: provider.model, ms: Math.round(performance.now() - started) };
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? e.code : 'unavailable' };
  }
}
