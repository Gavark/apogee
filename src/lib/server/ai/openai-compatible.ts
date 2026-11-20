import { LABEL_JSON_SCHEMA, normalizeAnalysis } from './contract';
import { buildLabelPrompt } from './prompt';
import { AiError, type AiProvider, type AnalyzeInput, type LabelAnalysis } from './types';

export function createOpenAiCompatibleProvider(opts: {
  apiKey: string | null;
  model: string;
  baseUrl: string;
  fetch?: typeof fetch;
}): AiProvider {
  const doFetch = opts.fetch ?? fetch;

  return {
    name: 'openai-compatible',
    model: opts.model,
    async analyzeLabel(input: AnalyzeInput): Promise<{ analysis: LabelAnalysis; model: string }> {
      const { system, user } = buildLabelPrompt({
        hints: input.hints,
        locale: input.locale,
        currentYear: input.currentYear,
        hasImage: input.image !== null
      });
      // json_schema is not supported by every compatible server: put the schema in the prompt.
      const userText = `${user}\n\nJSON Schema :\n${JSON.stringify(LABEL_JSON_SCHEMA)}`;
      const parts: unknown[] = [];
      if (input.image) {
        const b64 = Buffer.from(input.image.data).toString('base64');
        parts.push({ type: 'image_url', image_url: { url: `data:${input.image.mimeType};base64,${b64}` } });
      }
      parts.push({ type: 'text', text: userText });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

      let res: Response;
      try {
        res = await doFetch(`${opts.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(60_000),
          body: JSON.stringify({
            model: opts.model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: parts }
            ]
          })
        });
      } catch {
        throw new AiError('unavailable');
      }

      if (!res.ok) {
        void res.body?.cancel().catch(() => {});
        if (res.status === 401 || res.status === 403) throw new AiError('auth', res.status);
        if (res.status === 429) throw new AiError('rate_limited', res.status);
        throw new AiError('unavailable', res.status);
      }

      let data: { model?: unknown; choices?: { message?: { content?: unknown } }[] };
      try {
        data = (await res.json()) as typeof data;
      } catch (err) {
        // Timeout/abort while reading the body is an availability problem, not a bad answer.
        const name = (err as { name?: string } | null)?.name;
        if (name === 'AbortError' || name === 'TimeoutError') throw new AiError('unavailable');
        throw new AiError('invalid_response');
      }
      let raw: unknown;
      try {
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('no content');
        raw = JSON.parse(content);
      } catch {
        throw new AiError('invalid_response');
      }
      const analysis = normalizeAnalysis(raw, {
        currentYear: input.currentYear,
        acquiredYear: input.hints?.acquiredYear ?? null
      });
      return { analysis, model: typeof data.model === 'string' && data.model ? data.model : opts.model };
    }
  };
}
