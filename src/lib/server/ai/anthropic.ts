import Anthropic from '@anthropic-ai/sdk';
import { LABEL_JSON_SCHEMA, normalizeAnalysis } from './contract';
import { buildLabelPrompt } from './prompt';
import { AiError, type AiProvider, type AnalyzeInput, type LabelAnalysis } from './types';

type Client = Pick<Anthropic, 'beta'>;

function mapSdkError(err: unknown): AiError {
  // Most specific first. Never forward err.message: it may echo request details.
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
    return new AiError('auth');
  if (err instanceof Anthropic.RateLimitError) return new AiError('rate_limited');
  if (err instanceof Anthropic.APIConnectionError) return new AiError('unavailable');
  if (err instanceof Anthropic.APIError) return new AiError('unavailable', err.status);
  return new AiError('unavailable');
}

export function createAnthropicProvider(opts: { apiKey: string; model: string; client?: Client }): AiProvider {
  const client: Client =
    opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 2, timeout: 60_000 });

  return {
    name: 'anthropic',
    model: opts.model,
    async analyzeLabel(input: AnalyzeInput): Promise<LabelAnalysis> {
      const { system, user } = buildLabelPrompt({
        hints: input.hints,
        locale: input.locale,
        currentYear: input.currentYear,
        hasImage: input.image !== null
      });
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (input.image) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: input.image.mimeType,
            data: Buffer.from(input.image.data).toString('base64')
          }
        });
      }
      content.push({ type: 'text', text: user });

      let message;
      try {
        message = await client.beta.messages.create({
          model: opts.model,
          max_tokens: 4096,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: LABEL_JSON_SCHEMA } },
          system,
          messages: [{ role: 'user', content }]
        });
      } catch (err) {
        throw mapSdkError(err);
      }

      if (message.stop_reason === 'refusal') throw new AiError('refused');
      if (message.stop_reason === 'max_tokens') throw new AiError('invalid_response');

      const text = message.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new AiError('invalid_response');
      }
      return normalizeAnalysis(raw, {
        currentYear: input.currentYear,
        acquiredYear: input.hints?.acquiredYear ?? null
      });
    }
  };
}
