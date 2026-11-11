import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DbService } from '../db.service.js';
import { analyseMatch } from '../scoring/analyse.js';
import { AnalysesService } from './analyses.service.js';
import { SAMPLE_PAIRS } from './samples.js';

const CV = [
  'Experience',
  '- Built dashboards for managers in Excel',
  '- Migrated the order service to a new database',
].join('\n');
const JOB = 'Dashboards with Tableau, SQL and PostgreSQL experience required.';

function storedRow(id = 1) {
  const result = analyseMatch(CV, JOB);
  return {
    id,
    cv_text: CV,
    job_text: JOB,
    score: result.score,
    result: { matched: result.matched, missing: result.missing, bullets: result.bullets, tips: result.tips },
    rewrite: null,
    created_at: new Date('2026-01-02T03:04:05Z'),
  };
}

function makeDb(overrides: Partial<{ enabled: boolean }> = {}) {
  return {
    enabled: overrides.enabled ?? true,
    query: vi.fn(async (_sql: string, _params?: unknown[]): Promise<unknown[]> => [storedRow()]),
    withAdvisoryLock: vi.fn(),
  };
}

function makeService(db = makeDb()) {
  return { service: new AnalysesService(db as unknown as DbService), db };
}

function groqResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

describe('AnalysesService.rewrite', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('falls back to the rule-based tips when no key is set, without calling the provider', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { service } = makeService();

    const response = await service.rewrite(1);

    expect(response.source).toBe('algorithm');
    expect(response.bullets).toEqual([]);
    expect(response.tips.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the rule-based tips when the provider rate limits (429)', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-not-real');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })));
    const { service, db } = makeService();

    const response = await service.rewrite(1);

    expect(response).toMatchObject({ source: 'algorithm', bullets: [] });
    // Only the lookup query ran; nothing was stored for a failed rewrite.
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('falls back when the network call fails', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-not-real');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    const { service } = makeService();

    expect((await service.rewrite(1)).source).toBe('algorithm');
  });

  it('falls back when the answer is empty', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-not-real');
    vi.stubGlobal('fetch', vi.fn(async () => groqResponse('')));
    const { service } = makeService();

    expect((await service.rewrite(1)).source).toBe('algorithm');
  });

  it('returns AI bullets with originals and stores them when the model answers', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-not-real');
    vi.stubEnv('GROQ_MODEL', '');
    const fetchSpy = vi.fn(async () =>
      groqResponse('{"bullets":[{"index":1,"improved":"Built Excel dashboards that managers used every week"}]}'),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { service, db } = makeService();

    const response = await service.rewrite(1);

    expect(response.source).toBe('ai');
    expect(response.bullets).toEqual([
      {
        index: 1,
        original: 'Built dashboards for managers in Excel',
        improved: 'Built Excel dashboards that managers used every week',
      },
    ]);
    const body = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.model).toBe('openai/gpt-oss-20b');
    expect(db.query).toHaveBeenLastCalledWith('UPDATE analyses SET rewrite = $2 WHERE id = $1', expect.any(Array));
  });
});

describe('AnalysesService storage', () => {
  it('create runs the scorer and stores the result', async () => {
    const db = makeDb();
    db.query.mockImplementation(async (_sql: string, params: unknown[] = []) => [
      {
        id: 7,
        cv_text: params[0],
        job_text: params[1],
        score: params[2],
        result: JSON.parse(params[3] as string),
        rewrite: null,
        created_at: new Date('2026-01-02T03:04:05Z'),
      },
    ]);
    const { service } = makeService(db);

    const detail = await service.create({ cvText: CV, jobText: JOB });

    expect(detail.id).toBe(7);
    expect(detail.score).toBe(analyseMatch(CV, JOB).score);
    expect(detail.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(detail.cvText).toBe(CV);
    expect(detail.matched.length + detail.missing.length).toBeGreaterThan(0);
  });

  it('list computes the page offset and summarises each row', async () => {
    const db = makeDb();
    db.query
      .mockResolvedValueOnce([{ total: 23 }])
      .mockResolvedValueOnce([storedRow(3)]);
    const { service } = makeService(db);

    const page = await service.list({ page: 3, pageSize: 10 });

    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ORDER BY created_at DESC'), [10, 20]);
    expect(page.total).toBe(23);
    expect(page.items[0]).toMatchObject({ id: 3, matchedCount: expect.any(Number), missingCount: expect.any(Number) });
    expect(page.items[0].topMissing.length).toBeLessThanOrEqual(5);
    expect(page.items[0]).not.toHaveProperty('cvText');
  });

  it('get throws 404 for an unknown id', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce([]);
    const { service } = makeService(db);
    await expect(service.get(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove throws 404 when nothing was deleted', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce([]);
    const { service } = makeService(db);
    await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 503 with a clear message when no database is configured', async () => {
    const { service } = makeService(makeDb({ enabled: false }));
    await expect(service.create({ cvText: CV, jobText: JOB })).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.list({ page: 1, pageSize: 10 })).rejects.toThrow(/DATABASE_URL/);
  });
});

describe('AnalysesService seeding', () => {
  function seedQuery(count: number) {
    return vi.fn(async (sql: string) => (sql.includes('count(*)') ? [{ count }] : []));
  }

  it('inserts the sample analyses when the table is empty', async () => {
    const db = makeDb();
    const query = seedQuery(0);
    db.withAdvisoryLock.mockImplementation(async (_key: number, fn: (q: unknown) => Promise<unknown>) => fn(query));
    const { service } = makeService(db);

    await service.onModuleInit();

    expect(db.withAdvisoryLock).toHaveBeenCalledTimes(1);
    const inserts = query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT'));
    expect(inserts).toHaveLength(SAMPLE_PAIRS.length);
  });

  it('does not insert samples when history already has rows', async () => {
    const db = makeDb();
    const query = seedQuery(4);
    db.withAdvisoryLock.mockImplementation(async (_key: number, fn: (q: unknown) => Promise<unknown>) => fn(query));
    const { service } = makeService(db);

    await service.onModuleInit();

    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
  });

  it('starts even when seeding fails', async () => {
    const db = makeDb();
    db.withAdvisoryLock.mockRejectedValue(new Error('connection refused'));
    const { service } = makeService(db);
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
