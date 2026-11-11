import {
  buildUserPrompt,
  GROQ_CHAT_URL,
  parseRewriteContent,
  rewriteWithGroq,
  RewriteRequest,
} from './groq.js';

const API_KEY = 'test-key-not-real';
const MODEL = 'openai/gpt-oss-20b';

const request: RewriteRequest = {
  bullets: [
    { index: 1, text: 'Built dashboards for managers' },
    { index: 2, text: 'Migrated the order service' },
  ],
  keywords: ['tableau', 'sql'],
};

function completion(content: string, reasoning?: string): Response {
  const message = reasoning === undefined ? { content } : { content, reasoning };
  return new Response(JSON.stringify({ choices: [{ message }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(result: Response | Error) {
  return vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result.clone();
  });
}

function options(fetchImpl: ReturnType<typeof mockFetch>, timeoutMs?: number) {
  return { apiKey: API_KEY, model: MODEL, fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs };
}

describe('rewriteWithGroq', () => {
  it('sends a compact, low-effort request to the chat completions endpoint', async () => {
    const fetchImpl = mockFetch(
      completion('{"bullets":[{"index":1,"improved":"Built Tableau dashboards that managers used weekly"}]}'),
    );
    await rewriteWithGroq(request, options(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_CHAT_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(MODEL);
    expect(body.reasoning_effort).toBe('low');
    expect(body.max_completion_tokens).toBe(900);
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it('returns only the bullets that were sent, and uses the content rather than the reasoning field', async () => {
    const fetchImpl = mockFetch(
      completion(
        '{"bullets":[{"index":1,"improved":"Built Tableau dashboards for managers"},{"index":7,"improved":"Invented"}]}',
        'thinking about bullets...',
      ),
    );
    const outcome = await rewriteWithGroq(request, options(fetchImpl));
    expect(outcome).toEqual({
      ok: true,
      bullets: [{ index: 1, improved: 'Built Tableau dashboards for managers' }],
    });
  });

  it('caps the prompt at 10 bullets and 15 keywords', () => {
    const many: RewriteRequest = {
      bullets: Array.from({ length: 12 }, (_, i) => ({ index: i + 1, text: `bullet ${i + 1}` })),
      keywords: Array.from({ length: 20 }, (_, i) => `kw${i}`),
    };
    const prompt = buildUserPrompt(many);
    expect(prompt).toContain('10. bullet 10');
    expect(prompt).not.toContain('11. bullet 11');
    expect(prompt).toContain('kw14');
    expect(prompt).not.toContain('kw15');
  });

  it('does not call the provider when there are no bullets', async () => {
    const fetchImpl = mockFetch(completion('{}'));
    const outcome = await rewriteWithGroq({ bullets: [], keywords: [] }, options(fetchImpl));
    expect(outcome).toEqual({ ok: false, reason: 'empty' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports a rate limit (429) without throwing', async () => {
    const fetchImpl = mockFetch(new Response('slow down', { status: 429 }));
    expect(await rewriteWithGroq(request, options(fetchImpl))).toEqual({ ok: false, reason: 'rate-limited' });
  });

  it('reports other HTTP errors without throwing', async () => {
    const fetchImpl = mockFetch(new Response('nope', { status: 500 }));
    expect(await rewriteWithGroq(request, options(fetchImpl))).toEqual({ ok: false, reason: 'http-error' });
  });

  it('reports a timeout when the request is still pending after the limit', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const outcome = await rewriteWithGroq(request, {
      apiKey: API_KEY,
      model: MODEL,
      timeoutMs: 10,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toEqual({ ok: false, reason: 'timeout' });
  });

  it('reports a network failure without throwing', async () => {
    const fetchImpl = mockFetch(new TypeError('fetch failed'));
    expect(await rewriteWithGroq(request, options(fetchImpl))).toEqual({ ok: false, reason: 'network' });
  });

  it('reports an empty answer (no content, only reasoning)', async () => {
    const fetchImpl = mockFetch(completion('', 'I thought about it but produced nothing'));
    expect(await rewriteWithGroq(request, options(fetchImpl))).toEqual({ ok: false, reason: 'empty' });
  });

  it('reports a response with no choices as empty', async () => {
    const fetchImpl = mockFetch(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    expect(await rewriteWithGroq(request, options(fetchImpl))).toEqual({ ok: false, reason: 'empty' });
  });

  it('reports an unparsable answer', async () => {
    const fetchImpl = mockFetch(completion('Sorry, I cannot help with that.'));
    expect(await rewriteWithGroq(request, options(fetchImpl))).toEqual({ ok: false, reason: 'unparsable' });
  });

  it('reports a response body that is not JSON as unparsable', async () => {
    const fetchImpl = mockFetch(new Response('<html>gateway</html>', { status: 200 }));
    expect(await rewriteWithGroq(request, options(fetchImpl))).toEqual({ ok: false, reason: 'unparsable' });
  });
});

describe('parseRewriteContent', () => {
  const allowed = new Set([1, 2]);

  it('accepts JSON wrapped in a code fence or prose', () => {
    const content = 'Here you go:\n```json\n{"bullets":[{"index":2,"improved":"Migrated the order service to PostgreSQL"}]}\n```';
    expect(parseRewriteContent(content, allowed)).toEqual({
      ok: true,
      bullets: [{ index: 2, improved: 'Migrated the order service to PostgreSQL' }],
    });
  });

  it('drops blank improvements and duplicate indexes', () => {
    const content = JSON.stringify({
      bullets: [
        { index: 1, improved: '   ' },
        { index: 2, improved: 'First' },
        { index: 2, improved: 'Second' },
      ],
    });
    expect(parseRewriteContent(content, allowed)).toEqual({ ok: true, bullets: [{ index: 2, improved: 'First' }] });
  });

  it('treats a JSON object without a bullets array as unparsable', () => {
    expect(parseRewriteContent('{"answer":"x"}', allowed)).toEqual({ ok: false, reason: 'unparsable' });
  });

  it('treats an array of items that are all unusable as empty', () => {
    expect(parseRewriteContent('{"bullets":[{"index":"1","improved":"x"}]}', allowed)).toEqual({
      ok: false,
      reason: 'empty',
    });
  });
});
