import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

// Add new tables here as extra statements; they are all created once, behind a lock.
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, title TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
  `CREATE TABLE IF NOT EXISTS analyses (
    id SERIAL PRIMARY KEY,
    cv_text TEXT NOT NULL,
    job_text TEXT NOT NULL,
    score INTEGER NOT NULL,
    result JSONB NOT NULL,
    rewrite JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS analyses_created_idx ON analyses (created_at DESC, id DESC)',
];

export type Querier = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
    : null;
  private ready: Promise<void> | null = null;

  get enabled(): boolean {
    return this.pool !== null;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  /**
   * Runs `fn` in one transaction holding a transaction-scoped advisory lock, so that work which must
   * happen once (such as seeding) is not repeated by concurrent instances.
   */
  async withAdvisoryLock<T>(key: number, fn: (query: Querier) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [key]);
      const query: Querier = async <T>(sql: string, params: unknown[] = []) =>
        (await client.query(sql, params)).rows as T[];
      const result = await fn(query);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= (async () => {
      // Concurrent instances (serverless cold starts, parallel test files) race on CREATE TABLE IF NOT EXISTS,
      // so serialize schema setup behind a transaction-scoped advisory lock.
      const client = await this.pool!.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(727274)');
        for (const statement of SCHEMA) await client.query(statement);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        this.ready = null;
        throw err;
      } finally {
        client.release();
      }
    })();
    return this.ready;
  }
}
