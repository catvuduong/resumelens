// Optional AI rewrite via Groq's OpenAI-compatible endpoint. Plain fetch, no SDK.
// Every failure is returned as a reason code: callers fall back to the rule-based tips and never see a 5xx.

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
export const GROQ_TIMEOUT_MS = 20_000;
export const MAX_REWRITE_BULLETS = 10;
export const MAX_REWRITE_KEYWORDS = 15;
const MAX_BULLET_CHARS = 300;
const MAX_IMPROVED_CHARS = 400;
const MAX_COMPLETION_TOKENS = 900;

export type RewriteFailure = 'timeout' | 'rate-limited' | 'http-error' | 'network' | 'empty' | 'unparsable';

export interface ImprovedBullet {
  index: number;
  improved: string;
}

export type RewriteOutcome = { ok: true; bullets: ImprovedBullet[] } | { ok: false; reason: RewriteFailure };

export interface RewriteRequest {
  bullets: { index: number; text: string }[];
  keywords: string[];
}

export interface GroqOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const SYSTEM_PROMPT = [
  'You improve CV bullet points.',
  'Keep every fact truthful: never invent employers, dates, numbers, tools or results.',
  'Use a keyword from the list only if the original bullet already supports it. Never claim a skill the candidate has not shown.',
  'Start each bullet with a strong action verb and keep it under 35 words.',
  'Reply with JSON only, no prose, in this shape: {"bullets":[{"index":<number>,"improved":"<text>"}]}',
].join(' ');

/** Builds the compact user prompt: bullets and keywords only, never the full CV or job text. */
export function buildUserPrompt(request: RewriteRequest): string {
  const bullets = request.bullets
    .slice(0, MAX_REWRITE_BULLETS)
    .map((bullet) => `${bullet.index}. ${bullet.text.slice(0, MAX_BULLET_CHARS)}`);
  const keywords = request.keywords.slice(0, MAX_REWRITE_KEYWORDS);
  return [
    'Bullets:',
    ...bullets,
    `Keywords (only if supported by a bullet): ${keywords.length > 0 ? keywords.join(', ') : 'none'}`,
  ].join('\n');
}

/** True when GROQ_API_KEY is set. The key itself is never returned or logged. */
export function isAiEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

/** Sends one chat completion and maps the answer to improved bullets. Never throws. */
export async function rewriteWithGroq(request: RewriteRequest, options: GroqOptions): Promise<RewriteOutcome> {
  if (request.bullets.length === 0) return { ok: false, reason: 'empty' };
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? GROQ_TIMEOUT_MS);
  try {
    const response = await fetchImpl(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(request) },
        ],
        reasoning_effort: 'low',
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      }),
      signal: controller.signal,
    });
    if (response.status === 429) return { ok: false, reason: 'rate-limited' };
    if (!response.ok) return { ok: false, reason: 'http-error' };
    const text = await response.text();
    const content = extractContent(text);
    if (content === undefined) return { ok: false, reason: 'unparsable' };
    if (content.trim() === '') return { ok: false, reason: 'empty' };
    return parseRewriteContent(content, new Set(request.bullets.map((bullet) => bullet.index)));
  } catch {
    // Deliberately not logging the error: it may echo request details.
    return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** Reads choices[0].message.content. The reasoning field is ignored on purpose. */
function extractContent(body: string): string | undefined {
  try {
    const payload = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[] };
    const content = payload.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  } catch {
    return undefined;
  }
}

/** Parses the model's JSON answer, keeping only bullets that were sent and have text. */
export function parseRewriteContent(content: string, allowedIndexes: ReadonlySet<number>): RewriteOutcome {
  const parsed = parseJsonObject(content);
  if (!parsed || !Array.isArray(parsed.bullets)) return { ok: false, reason: 'unparsable' };

  const seen = new Set<number>();
  const bullets: ImprovedBullet[] = [];
  for (const item of parsed.bullets as unknown[]) {
    const { index, improved } = (item ?? {}) as { index?: unknown; improved?: unknown };
    if (typeof index !== 'number' || !allowedIndexes.has(index) || seen.has(index)) continue;
    if (typeof improved !== 'string' || improved.trim() === '') continue;
    seen.add(index);
    bullets.push({ index, improved: improved.trim().slice(0, MAX_IMPROVED_CHARS) });
  }
  return bullets.length > 0 ? { ok: true, bullets } : { ok: false, reason: 'empty' };
}

function parseJsonObject(content: string): { bullets?: unknown } | undefined {
  const candidates = [content.trim()];
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(content.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (typeof value === 'object' && value !== null) return value as { bullets?: unknown };
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}
