/**
 * LLM provider abstraction — Gemini (Google) + Mistral (EU, OpenAI-compatible).
 *
 * Background: Google's tier/quota has been unreliable (429s on fresh keys while
 * AI Studio still reports "downgraded"). We want every Gemini-dependent app to
 * also have a Mistral path so the fleet survives when Google is down. We do NOT
 * remove Gemini — provider is chosen per-request from the model id, and Gemini
 * can come back to life without a code change.
 *
 * Pattern mirrors chat-app/server/llm-provider.ts: Mistral runs through the
 * OpenAI SDK pointed at api.mistral.ai (tool/JSON schemas are identical), and
 * `mistral-medium-3.5` is the workhorse default.
 */
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

export type LLMProvider = 'gemini' | 'mistral';

export interface AIModelOption {
  id: string;
  label: string;
  provider: LLMProvider;
}

/**
 * Selectable models. Mistral first → it's the default when nothing is chosen.
 * Add more Gemini ids here as the key/tier allows (keep `gemini-2.5-flash` — the
 * one historically known to work on this project's key).
 */
export const AI_MODELS: AIModelOption[] = [
  { id: 'mistral-medium-3.5', label: 'Mistral Medium 3.5', provider: 'mistral' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
];

export const DEFAULT_MODEL = 'mistral-medium-3.5';

/**
 * Resolve a model id (possibly missing/unknown) to a concrete model+provider.
 * Falls back to the default (Mistral) when nothing is chosen, and tolerates
 * ids not in the registry by routing on the `gemini`/`mistral` prefix so a
 * frontend list that drifts ahead never breaks the backend.
 */
export function resolveModel(model?: string | null): AIModelOption {
  if (model) {
    const known = AI_MODELS.find((m) => m.id === model);
    if (known) return known;
    if (model.startsWith('mistral')) return { id: model, label: model, provider: 'mistral' };
    if (model.startsWith('gemini')) return { id: model, label: model, provider: 'gemini' };
  }
  return AI_MODELS.find((m) => m.id === DEFAULT_MODEL)!;
}

// Gemini-style content part — matches the shape already built in routes/ai.ts.
export type ContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface GenerateOptions {
  model?: string | null;
  systemInstruction: string;
  parts: ContentPart[];
  /**
   * Request JSON output. `'object'` → top-level `{...}`, `'array'` → top-level
   * `[...]`. Gemini gets `responseMimeType: application/json` either way. Mistral
   * gets `response_format: json_object` ONLY for `'object'` (its json_object mode
   * forbids a top-level array), and relies on the prompt for `'array'`.
   */
  json?: 'object' | 'array';
  maxTokens?: number;
}

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY saknas — Gemini-modeller är inte konfigurerade');
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

let mistralClient: OpenAI | null = null;
function getMistral(): OpenAI {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error('MISTRAL_API_KEY saknas — Mistral är inte konfigurerad');
    mistralClient = new OpenAI({ apiKey, baseURL: 'https://api.mistral.ai/v1' });
  }
  return mistralClient;
}

/** Generate text from either provider. Returns the raw model text. */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const resolved = resolveModel(opts.model);
  return resolved.provider === 'gemini'
    ? generateGemini(resolved.id, opts)
    : generateMistral(resolved.id, opts);
}

async function generateGemini(model: string, opts: GenerateOptions): Promise<string> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model,
    contents: opts.parts as any,
    config: {
      systemInstruction: opts.systemInstruction,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
    },
  });
  return response.text || '';
}

async function generateMistral(model: string, opts: GenerateOptions): Promise<string> {
  const client = getMistral();

  // Gemini-style parts → OpenAI message content. inlineData rides as a data-URI
  // image_url part (mistral-medium-3.5 is vision-capable).
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = opts.parts.map((p) =>
    'text' in p
      ? { type: 'text', text: p.text }
      : {
          type: 'image_url',
          image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` },
        }
  );

  const res = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 8192,
    messages: [
      { role: 'system', content: opts.systemInstruction },
      { role: 'user', content },
    ],
    // json_object mode forbids a top-level array → only use it for `'object'`.
    ...(opts.json === 'object' ? { response_format: { type: 'json_object' as const } } : {}),
  });

  return res.choices[0]?.message?.content ?? '';
}

/**
 * Strip a ```json … ``` (or bare ```) markdown fence if the model wrapped its
 * JSON in one. Gemini's responseMimeType returns clean JSON (no-op here); Mistral
 * occasionally fences when not in json_object mode. Use before JSON.parse.
 */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fence ? fence[1] : trimmed).trim();
}
