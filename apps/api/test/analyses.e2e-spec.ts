import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

const CV = [
  'Sample candidate',
  '- Built internal dashboards in React and TypeScript for 300 users',
  '- Responsible for deploying services with Docker',
].join('\n');
const JOB = 'Frontend engineer: React, TypeScript, Kubernetes and Docker experience required.';

// These tests run against the real database (DATABASE_URL), like the rest of the suite.
describe('Analyses API (e2e)', () => {
  let app: INestApplication<App>;
  let savedKey: string | undefined;

  beforeAll(async () => {
    // Every test here runs without an AI key unless it sets one explicitly.
    savedKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (savedKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedKey;
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  async function createAnalysis(cvText = CV, jobText = JOB) {
    const res = await server().post('/analyses').send({ cvText, jobText }).expect(201);
    return res.body as { id: number; score: number; createdAt: string };
  }

  describe('GET /capabilities', () => {
    it('reports ai: false when no key is set', async () => {
      const res = await server().get('/capabilities').expect(200);
      expect(res.body).toEqual({ ai: false });
    });

    it('reports ai: true when a key is set, without ever returning the key', async () => {
      process.env.GROQ_API_KEY = 'test-key-not-real';
      try {
        const res = await server().get('/capabilities').expect(200);
        expect(res.body).toEqual({ ai: true });
        expect(JSON.stringify(res.body)).not.toContain('test-key-not-real');
      } finally {
        delete process.env.GROQ_API_KEY;
      }
    });
  });

  describe('POST /analyses', () => {
    it('creates an analysis with a score, keywords, bullets and tips', async () => {
      const res = await server().post('/analyses').send({ cvText: CV, jobText: JOB }).expect(201);
      expect(res.body).toMatchObject({
        id: expect.any(Number),
        createdAt: expect.any(String),
        cvText: CV,
        jobText: JOB,
        rewrite: null,
      });
      expect(res.body.score).toBeGreaterThanOrEqual(0);
      expect(res.body.score).toBeLessThanOrEqual(100);
      expect(res.body.matched.map((k: { term: string }) => k.term)).toEqual(expect.arrayContaining(['react', 'typescript', 'docker']));
      expect(res.body.missing.map((k: { term: string }) => k.term)).toContain('kubernetes');
      expect(res.body.bullets).toHaveLength(2);
      expect(res.body.tips.length).toBeGreaterThan(0);
    });

    it('rejects a missing body with clear messages', async () => {
      const res = await server().post('/analyses').send({}).expect(400);
      expect(res.body.message).toEqual(['cvText is required', 'jobText is required']);
    });

    it('rejects blank text', async () => {
      const res = await server().post('/analyses').send({ cvText: '   ', jobText: JOB }).expect(400);
      expect(res.body.message).toEqual(['cvText must not be empty']);
    });

    it('rejects text over 8000 characters', async () => {
      const res = await server().post('/analyses').send({ cvText: CV, jobText: 'x'.repeat(8001) }).expect(400);
      expect(res.body.message).toEqual(['jobText must be at most 8000 characters (got 8001)']);
    });

    it('accepts text of exactly 8000 characters', async () => {
      const jobText = `${JOB} ${'filler '.repeat(1200)}`.slice(0, 8000);
      expect(jobText).toHaveLength(8000);
      await server().post('/analyses').send({ cvText: CV, jobText }).expect(201);
    });

    it('rejects non-string text', async () => {
      const res = await server().post('/analyses').send({ cvText: 12, jobText: JOB }).expect(400);
      expect(res.body.message).toEqual(['cvText must be a string']);
    });
  });

  describe('GET /analyses', () => {
    it('lists the newest analysis first', async () => {
      const older = await createAnalysis();
      const newer = await createAnalysis();
      const res = await server().get('/analyses').query({ pageSize: 50 }).expect(200);
      const ids = res.body.items.map((item: { id: number }) => item.id);
      expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
      expect(res.body.items[0].id).toBe(newer.id);
      expect(res.body.items[0]).not.toHaveProperty('cvText');
    });

    it('paginates with page and pageSize', async () => {
      await createAnalysis();
      const first = await server().get('/analyses').query({ page: 1, pageSize: 2 }).expect(200);
      const second = await server().get('/analyses').query({ page: 2, pageSize: 2 }).expect(200);
      expect(first.body).toMatchObject({ page: 1, pageSize: 2 });
      expect(first.body.items).toHaveLength(2);
      expect(first.body.total).toBeGreaterThanOrEqual(3);
      expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
      expect(first.body.items[0]).toMatchObject({
        score: expect.any(Number),
        topMissing: expect.any(Array),
        matchedCount: expect.any(Number),
        missingCount: expect.any(Number),
      });
    });

    it('rejects an invalid page size with a clear message', async () => {
      const res = await server().get('/analyses').query({ pageSize: 500 }).expect(400);
      expect(res.body.message).toBe('pageSize must be an integer between 1 and 50');
    });
  });

  describe('GET /analyses/:id', () => {
    it('returns one analysis including its texts', async () => {
      const created = await createAnalysis();
      const res = await server().get(`/analyses/${created.id}`).expect(200);
      expect(res.body).toMatchObject({ id: created.id, score: created.score, cvText: CV, jobText: JOB });
    });

    it('returns 404 for an unknown id', async () => {
      await server().get('/analyses/2147483647').expect(404);
    });

    it('returns 400 for an id that is not a positive integer', async () => {
      const res = await server().get('/analyses/abc').expect(400);
      expect(res.body.message).toBe('id must be a positive integer (got "abc")');
    });
  });

  describe('DELETE /analyses/:id', () => {
    it('removes an analysis, then reports 404 for it', async () => {
      const created = await createAnalysis();
      await server().delete(`/analyses/${created.id}`).expect(204);
      await server().get(`/analyses/${created.id}`).expect(404);
      await server().delete(`/analyses/${created.id}`).expect(404);
    });
  });

  describe('POST /analyses/:id/rewrite', () => {
    it('returns rule-based tips with source "algorithm" when no key is set', async () => {
      const created = await createAnalysis();
      const res = await server().post(`/analyses/${created.id}/rewrite`).expect(200);
      expect(res.body).toEqual({ source: 'algorithm', bullets: [], tips: expect.any(Array) });
      expect(res.body.tips.length).toBeGreaterThan(0);
    });

    it('returns 404 for an unknown analysis', async () => {
      await server().post('/analyses/2147483647/rewrite').expect(404);
    });
  });
});
