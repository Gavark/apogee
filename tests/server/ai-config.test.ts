import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readAiConfig, aiDailyLimit, describeAiConfig, _resetAiProviderForTests } from '$lib/server/ai/config';

describe('readAiConfig', () => {
  it('clé seule → anthropic avec claude-opus-5-5', () =>
    expect(readAiConfig({ AI_API_KEY: 'k' })).toEqual({
      provider: 'anthropic',
      apiKey: 'k',
      model: 'claude-opus-5-5'
    }));
  it('AI_MODEL surcharge le modèle Anthropic', () =>
    expect(readAiConfig({ AI_API_KEY: 'k', AI_MODEL: 'm' })).toEqual({
      provider: 'anthropic',
      apiKey: 'k',
      model: 'm'
    }));
  it("rien → none ; AI_PROVIDER=none l'emporte sur une clé", () => {
    expect(readAiConfig({})).toEqual({ provider: 'none' });
    expect(readAiConfig({ AI_API_KEY: '  ' })).toEqual({ provider: 'none' });
    expect(readAiConfig({ AI_PROVIDER: 'none', AI_API_KEY: 'k' })).toEqual({ provider: 'none' });
  });
  it('anthropic explicite sans clé → none', () =>
    expect(readAiConfig({ AI_PROVIDER: 'anthropic' })).toEqual({ provider: 'none' }));
  it('openai-compatible sans AI_BASE_URL ou sans AI_MODEL → none', () => {
    expect(readAiConfig({ AI_PROVIDER: 'openai-compatible', AI_MODEL: 'm' })).toEqual({ provider: 'none' });
    expect(
      readAiConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'http://localhost:11434/v1' })
    ).toEqual({ provider: 'none' });
  });
  it('openai-compatible valide, clé optionnelle', () =>
    expect(
      readAiConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'http://h/v1', AI_MODEL: 'm' })
    ).toEqual({ provider: 'openai-compatible', apiKey: null, model: 'm', baseUrl: 'http://h/v1' }));
  it('baseUrl : / final retiré ; schéma non http(s) refusé', () => {
    const ok = readAiConfig({
      AI_PROVIDER: 'openai-compatible',
      AI_BASE_URL: 'https://h/v1//',
      AI_MODEL: 'm',
      AI_API_KEY: 'k'
    });
    expect(ok).toMatchObject({ baseUrl: 'https://h/v1', apiKey: 'k' });
    expect(
      readAiConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'ftp://h/v1', AI_MODEL: 'm' })
    ).toEqual({ provider: 'none' });
  });
});

describe('aiDailyLimit', () => {
  it('défaut 100, "0" → 0, "abc" → 100', () => {
    expect(aiDailyLimit({})).toBe(100);
    expect(aiDailyLimit({ AI_DAILY_LIMIT_PER_HOUSEHOLD: '0' })).toBe(0);
    expect(aiDailyLimit({ AI_DAILY_LIMIT_PER_HOUSEHOLD: '25' })).toBe(25);
    expect(aiDailyLimit({ AI_DAILY_LIMIT_PER_HOUSEHOLD: 'abc' })).toBe(100);
    expect(aiDailyLimit({ AI_DAILY_LIMIT_PER_HOUSEHOLD: '-3' })).toBe(100);
  });
});

describe('describeAiConfig', () => {
  it('ne contient jamais la clé', () => {
    const d = describeAiConfig(readAiConfig({ AI_API_KEY: 'sk-secret' }));
    expect(JSON.stringify(d)).not.toContain('sk-secret');
    expect(d).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5', baseUrl: null, configured: true });
  });
  it('none → non configuré', () =>
    expect(describeAiConfig({ provider: 'none' })).toEqual({
      provider: 'none',
      model: null,
      baseUrl: null,
      configured: false
    }));
});

describe('baseUrl avec identifiants et avertissement unique', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    _resetAiProviderForTests();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('AI_BASE_URL avec identifiants → none', () => {
    for (const url of ['http://user:pw@h/v1', 'http://user@h/v1'])
      expect(readAiConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: url, AI_MODEL: 'm' })).toEqual({
        provider: 'none'
      });
  });

  it("avertit une seule fois, sans valeur de variable", () => {
    const env = {
      AI_PROVIDER: 'openai-compatible',
      AI_BASE_URL: 'http://user:s3cret@h/v1',
      AI_MODEL: 'secret-model',
      AI_API_KEY: 'sk-topsecret'
    };
    readAiConfig(env);
    readAiConfig(env);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0].join(' '));
    for (const v of ['s3cret', 'user', 'secret-model', 'sk-topsecret', 'http://']) expect(msg).not.toContain(v);
  });
});
