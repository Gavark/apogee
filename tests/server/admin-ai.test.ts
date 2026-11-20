import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../helpers/db';
import { makeHousehold } from '../helpers/fixtures';
import { fakeProvider, sampleAnalysis } from '../helpers/fake-ai';
import { aiStatus, testAiProvider } from '../../src/routes/admin/_ai';
import { AiError } from '../../src/lib/server/ai/types';

let tdb: ReturnType<typeof makeTestDb>;
beforeEach(() => {
  tdb = makeTestDb();
});

const insert = (hid: number, createdAt: number, result: string | null) =>
  tdb.db.insert(tdb.schema.labelAnalyses).values({ householdId: hid, result, createdAt }).run();

describe('aiStatus', () => {
  it('ne contient jamais la clé', () => {
    const env = { AI_PROVIDER: 'anthropic', AI_API_KEY: 'sk-secret-123', AI_DAILY_LIMIT_PER_HOUSEHOLD: '7' };
    const s = aiStatus(tdb.db, env);
    expect(JSON.stringify(s)).not.toContain('sk-secret-123');
    expect(s).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', configured: true, dailyLimit: 7 });
  });

  it('non configuré : provider none', () => {
    expect(aiStatus(tdb.db, {})).toMatchObject({ provider: 'none', configured: false, analysesToday: 0 });
  });

  it('compte les analyses réussies du jour, tous foyers, en UTC', () => {
    const h1 = makeHousehold(tdb, 'A');
    const h2 = makeHousehold(tdb, 'B');
    const now = new Date();
    const utcMidnight = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
    insert(h1, utcMidnight, '{}');
    insert(h2, utcMidnight + 5, '{}');
    insert(h2, utcMidnight + 6, null); // échec : ignoré
    insert(h1, utcMidnight - 1, '{}'); // hier : ignoré
    expect(aiStatus(tdb.db, {}, now).analysesToday).toBe(2);
  });
});

describe('testAiProvider', () => {
  it('ok avec le modèle et une durée, appel sans image avec indices fixes', async () => {
    const p = fakeProvider(sampleAnalysis());
    const r = await testAiProvider(p);
    expect(r).toMatchObject({ ok: true, model: 'fake-model' });
    expect(r.ok && r.ms).toBeGreaterThanOrEqual(0);
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0].image).toBeNull();
    expect(p.calls[0].hints).toMatchObject({ producer: 'Château Margaux', appellation: 'Margaux', color: 'red', vintage: 2015 });
  });

  it('provider null → not_configured', async () => {
    expect(await testAiProvider(null)).toEqual({ ok: false, error: 'not_configured' });
  });

  it('AiError → son code ; autre exception → unavailable', async () => {
    expect(await testAiProvider(fakeProvider(new AiError('auth', 401)))).toEqual({ ok: false, error: 'auth' });
    const boom = { name: 'x', model: 'm', analyzeLabel: async () => { throw new Error('boom'); } };
    expect(await testAiProvider(boom)).toEqual({ ok: false, error: 'unavailable' });
  });

  it('ne crée aucune ligne label_analyses', async () => {
    await testAiProvider(fakeProvider(sampleAnalysis()));
    await testAiProvider(null);
    expect(tdb.db.select().from(tdb.schema.labelAnalyses).all()).toHaveLength(0);
  });
});
