import { describe, it, expect, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicProvider } from '$lib/server/ai/anthropic';
import { AiError, type AnalyzeInput } from '$lib/server/ai/types';
import { LABEL_JSON_SCHEMA } from '$lib/server/ai/contract';

const KEY = 'sk-ant-secret-key';
const input: AnalyzeInput = {
  image: { data: new Uint8Array([1, 2, 3]), mimeType: 'image/png' },
  hints: null,
  locale: 'fr',
  currentYear: 2026
};
const goodJson = {
  is_wine_label: true,
  producer: 'Domaine X',
  vintage: 2018,
  confidence: 'high',
  window: { drink_from: 2024, peak_from: 2026, peak_to: 2030, drink_until: 2035 }
};
const ok = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

function setup(result: unknown) {
  const create = vi.fn(async (..._args: unknown[]) => {
    if (typeof result === 'function') (result as () => never)();
    return result;
  });
  const provider = createAnthropicProvider({
    apiKey: KEY,
    model: 'claude-opus-5-5',
    client: { beta: { messages: { create } } } as never
  });
  return { create, provider };
}

function firstArg(create: { mock: { calls: unknown[][] } }): Record<string, any> {
  return create.mock.calls[0][0] as Record<string, any>;
}

describe('anthropic provider', () => {
  it('expose name et model', () => {
    const { provider } = setup(ok('{}'));
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-opus-5-5');
  });

  it('envoie modèle, fallbacks default, beta, effort medium, json_schema, image avant texte', async () => {
    const { create, provider } = setup(ok(JSON.stringify(goodJson)));
    const res = await provider.analyzeLabel(input);
    expect(res.producer).toBe('Domaine X');
    expect(create).toHaveBeenCalledTimes(1);
    const arg = firstArg(create);
    expect(arg.model).toBe('claude-opus-5-5');
    expect(arg.max_tokens).toBe(4096);
    expect(arg.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(arg.fallbacks).toBe('default');
    expect(arg.output_config).toEqual({
      effort: 'medium',
      format: { type: 'json_schema', schema: LABEL_JSON_SCHEMA }
    });
    expect(typeof arg.system).toBe('string');
    expect(arg.messages).toHaveLength(1);
    expect(arg.messages[0].role).toBe('user');
    const content = arg.messages[0].content;
    expect(content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: Buffer.from([1, 2, 3]).toString('base64') }
    });
    expect(content[1].type).toBe('text');
  });

  it("n'envoie pas de paramètre thinking, temperature, top_p, top_k", async () => {
    const { create, provider } = setup(ok(JSON.stringify(goodJson)));
    await provider.analyzeLabel(input);
    const arg = firstArg(create);
    for (const k of ['thinking', 'temperature', 'top_p', 'top_k']) expect(arg).not.toHaveProperty(k);
  });

  it('sans image : un seul bloc texte', async () => {
    const { create, provider } = setup(ok(JSON.stringify(goodJson)));
    await provider.analyzeLabel({ ...input, image: null });
    const content = firstArg(create).messages[0].content;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
  });

  it('ignore les blocs non texte et concatène les blocs texte', async () => {
    const json = JSON.stringify(goodJson);
    const { provider } = setup({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: 'hmm' },
        { type: 'text', text: json.slice(0, 10) },
        { type: 'fallback' },
        { type: 'text', text: json.slice(10) }
      ]
    });
    expect((await provider.analyzeLabel(input)).producer).toBe('Domaine X');
  });

  it('stop_reason refusal → AiError refused', async () => {
    const { provider } = setup({ stop_reason: 'refusal', content: [] });
    await expect(provider.analyzeLabel(input)).rejects.toMatchObject({ code: 'refused' });
  });

  it('stop_reason max_tokens → invalid_response', async () => {
    const { provider } = setup({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a' }] });
    await expect(provider.analyzeLabel(input)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('texte non JSON → invalid_response', async () => {
    const { provider } = setup(ok('pas du json'));
    await expect(provider.analyzeLabel(input)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  const h = new Headers();
  const cases: [string, () => Error, string, number | undefined][] = [
    ['AuthenticationError', () => new Anthropic.AuthenticationError(401, {}, 'bad ' + KEY, h), 'auth', undefined],
    ['PermissionDeniedError', () => new Anthropic.PermissionDeniedError(403, {}, 'nope ' + KEY, h), 'auth', undefined],
    ['RateLimitError', () => new Anthropic.RateLimitError(429, {}, 'slow ' + KEY, h), 'rate_limited', undefined],
    ['BadRequestError', () => new Anthropic.BadRequestError(400, {}, 'bad ' + KEY, h), 'unavailable', 400],
    ['InternalServerError', () => new Anthropic.InternalServerError(500, {}, 'boom ' + KEY, h), 'unavailable', 500],
    ['APIConnectionError', () => new Anthropic.APIConnectionError({ message: 'down ' + KEY }), 'unavailable', undefined]
  ];
  it.each(cases)('%s → %s', async (_n, make, code, status) => {
    const { provider } = setup(() => {
      throw make();
    });
    const err = await provider.analyzeLabel(input).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe(code);
    if (status !== undefined) expect(err.status).toBe(status);
    // le message d'erreur levé ne contient jamais la clé
    expect(err.message).not.toContain(KEY);
    expect(JSON.stringify(err)).not.toContain(KEY);
  });

  it('erreur inconnue → unavailable sans fuite du message', async () => {
    const { provider } = setup(() => {
      throw new Error('boom ' + KEY);
    });
    const err = await provider.analyzeLabel(input).catch((e) => e);
    expect(err).toMatchObject({ code: 'unavailable' });
    expect(err.message).not.toContain(KEY);
  });
});
