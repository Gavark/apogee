import { describe, it, expect, vi } from 'vitest';
import { createOpenAiCompatibleProvider } from '$lib/server/ai/openai-compatible';
import type { AnalyzeInput } from '$lib/server/ai/types';

const input: AnalyzeInput = {
  image: { data: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' },
  hints: null,
  locale: 'en',
  currentYear: 2026
};
const goodJson = { is_wine_label: true, producer: 'Domaine X', vintage: 2018, confidence: 'medium' };
const reply = (content: unknown, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

function make(fetchImpl: (url: string, init: RequestInit) => Promise<Response>, apiKey: string | null = 'k') {
  const fetchMock = vi.fn(fetchImpl);
  const provider = createOpenAiCompatibleProvider({
    apiKey,
    model: 'llava',
    baseUrl: 'http://host/v1',
    fetch: fetchMock as unknown as typeof fetch
  });
  return { fetchMock, provider };
}

describe('openai-compatible provider', () => {
  it('expose name et model', () => {
    const { provider } = make(async () => reply('{}'));
    expect(provider.name).toBe('openai-compatible');
    expect(provider.model).toBe('llava');
  });

  it('POST {baseUrl}/chat/completions avec data URL, response_format json_object, Bearer', async () => {
    const { fetchMock, provider } = make(async () => reply(JSON.stringify(goodJson)));
    const res = await provider.analyzeLabel(input);
    expect(res.producer).toBe('Domaine X');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://host/v1/chat/completions');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer k');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('llava');
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    const parts = body.messages[1].content;
    expect(parts[0]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${Buffer.from([1, 2, 3]).toString('base64')}` }
    });
    expect(parts[1].type).toBe('text');
    expect(parts[1].text).toContain('is_wine_label'); // JSON Schema en fin de prompt
  });

  it("pas de clé → pas d'en-tête Authorization", async () => {
    const { fetchMock, provider } = make(async () => reply(JSON.stringify(goodJson)), null);
    await provider.analyzeLabel(input);
    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect(Object.keys(init.headers as object).map((k) => k.toLowerCase())).not.toContain('authorization');
  });

  it('sans image : un seul bloc texte', async () => {
    const { fetchMock, provider } = make(async () => reply(JSON.stringify(goodJson)));
    await provider.analyzeLabel({ ...input, image: null });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.messages[1].content).toHaveLength(1);
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limited'],
    [500, 'unavailable']
  ])('HTTP %i → %s', async (status, code) => {
    const { provider } = make(async () => new Response('x', { status }));
    await expect(provider.analyzeLabel(input)).rejects.toMatchObject({ code });
  });

  it('réseau ou timeout → unavailable', async () => {
    const { provider } = make(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(provider.analyzeLabel(input)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('content non JSON, absent ou corps illisible → invalid_response', async () => {
    for (const r of [
      () => reply('pas du json'),
      () => reply(undefined),
      () => new Response('<html>', { status: 200 })
    ]) {
      const { provider } = make(async () => r());
      await expect(provider.analyzeLabel(input)).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('JSON valide → normalizeAnalysis appliqué (millésime futur rejeté)', async () => {
    const { provider } = make(async () => reply(JSON.stringify({ ...goodJson, vintage: 2999 })));
    const res = await provider.analyzeLabel(input);
    expect(res.vintage).toBeNull();
    expect(res.confidence).toBe('medium');
  });
});
