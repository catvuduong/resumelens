import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DbService } from '../db.service.js';
import { analyseMatch, AnalysisResult, Bullet, Keyword } from '../scoring/analyse.js';
import {
  DEFAULT_GROQ_MODEL,
  MAX_REWRITE_BULLETS,
  MAX_REWRITE_KEYWORDS,
  rewriteWithGroq,
} from './groq.js';
import { SAMPLE_PAIRS } from './samples.js';
import { AnalysisInput, Pagination } from './validation.js';

const SEED_LOCK_KEY = 727275;
const TOP_MISSING_COUNT = 5;

export interface RewrittenBullet {
  index: number;
  original: string;
  improved: string;
}

export interface RewriteRecord {
  createdAt: string;
  bullets: RewrittenBullet[];
}

export interface AnalysisDetail extends AnalysisResult {
  id: number;
  createdAt: string;
  cvText: string;
  jobText: string;
  rewrite: RewriteRecord | null;
}

export interface AnalysisSummary {
  id: number;
  createdAt: string;
  score: number;
  matchedCount: number;
  missingCount: number;
  topMissing: string[];
}

export interface AnalysisPage {
  items: AnalysisSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RewriteResponse {
  /** "ai" only when the model answered; otherwise the rule-based tips are returned. */
  source: 'ai' | 'algorithm';
  bullets: RewrittenBullet[];
  tips: string[];
}

interface AnalysisRow {
  id: number;
  cv_text: string;
  job_text: string;
  score: number;
  result: StoredResult;
  rewrite: RewriteRecord | null;
  created_at: Date | string;
}

type StoredResult = Pick<AnalysisResult, 'matched' | 'missing' | 'bullets' | 'tips'>;

const STORAGE_DISABLED = 'History storage is not configured: set DATABASE_URL to use analyses.';

@Injectable()
export class AnalysesService implements OnModuleInit {
  private readonly logger = new Logger(AnalysesService.name);

  constructor(private readonly db: DbService) {}

  async onModuleInit(): Promise<void> {
    if (!this.db.enabled) return;
    try {
      await this.seedSamples();
    } catch {
      // Seeding is a convenience; the app must still start when the database is unreachable.
      this.logger.warn('Could not seed sample analyses; history starts empty.');
    }
  }

  async create(input: AnalysisInput): Promise<AnalysisDetail> {
    this.requireDb();
    const result = analyseMatch(input.cvText, input.jobText);
    const rows = await this.db.query<AnalysisRow>(
      'INSERT INTO analyses (cv_text, job_text, score, result) VALUES ($1, $2, $3, $4) RETURNING *',
      [input.cvText, input.jobText, result.score, JSON.stringify(toStoredResult(result))],
    );
    return toDetail(rows[0]);
  }

  async list({ page, pageSize }: Pagination): Promise<AnalysisPage> {
    this.requireDb();
    const [{ total }] = await this.db.query<{ total: number }>('SELECT count(*)::int AS total FROM analyses');
    const rows = await this.db.query<AnalysisRow>(
      'SELECT id, score, result, created_at FROM analyses ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
      [pageSize, (page - 1) * pageSize],
    );
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  async get(id: number): Promise<AnalysisDetail> {
    this.requireDb();
    const rows = await this.db.query<AnalysisRow>('SELECT * FROM analyses WHERE id = $1', [id]);
    if (rows.length === 0) throw new NotFoundException(`analysis ${id} not found`);
    return toDetail(rows[0]);
  }

  async remove(id: number): Promise<void> {
    this.requireDb();
    const rows = await this.db.query<{ id: number }>('DELETE FROM analyses WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new NotFoundException(`analysis ${id} not found`);
  }

  /**
   * Improves the CV bullets with the Groq model when GROQ_API_KEY is set. Every failure, including a
   * missing key, a timeout, a 429 or an empty answer, resolves to source "algorithm" with the rule-based tips.
   */
  async rewrite(id: number): Promise<RewriteResponse> {
    const analysis = await this.get(id);
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) return fallback(analysis);

    const bullets = analysis.bullets.slice(0, MAX_REWRITE_BULLETS);
    if (bullets.length === 0) return fallback(analysis);
    const keywords = analysis.missing.slice(0, MAX_REWRITE_KEYWORDS).map((keyword) => keyword.term);

    const outcome = await rewriteWithGroq(
      { bullets, keywords },
      { apiKey, model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL },
    );
    if (!outcome.ok) {
      this.logger.warn(`AI rewrite unavailable (${outcome.reason}); returning rule-based tips.`);
      return fallback(analysis);
    }

    const originals = new Map(bullets.map((bullet) => [bullet.index, bullet.text]));
    const rewritten: RewrittenBullet[] = outcome.bullets.flatMap((item) => {
      const original = originals.get(item.index);
      return original === undefined ? [] : [{ index: item.index, original, improved: item.improved }];
    });
    if (rewritten.length === 0) return fallback(analysis);

    const record: RewriteRecord = { createdAt: new Date().toISOString(), bullets: rewritten };
    await this.db.query('UPDATE analyses SET rewrite = $2 WHERE id = $1', [id, JSON.stringify(record)]);
    return { source: 'ai', bullets: rewritten, tips: analysis.tips };
  }

  /** Inserts three fictional analyses the first time the table is empty. Runs once across instances. */
  private async seedSamples(): Promise<void> {
    await this.db.withAdvisoryLock(SEED_LOCK_KEY, async (query) => {
      const [{ count }] = await query<{ count: number }>('SELECT count(*)::int AS count FROM analyses');
      if (count > 0) return;
      for (const pair of SAMPLE_PAIRS) {
        const result = analyseMatch(pair.cvText, pair.jobText);
        await query(
          'INSERT INTO analyses (cv_text, job_text, score, result) VALUES ($1, $2, $3, $4)',
          [pair.cvText, pair.jobText, result.score, JSON.stringify(toStoredResult(result))],
        );
      }
    });
  }

  private requireDb(): void {
    if (!this.db.enabled) throw new ServiceUnavailableException(STORAGE_DISABLED);
  }
}

function fallback(analysis: AnalysisDetail): RewriteResponse {
  return { source: 'algorithm', bullets: [], tips: analysis.tips };
}

function toStoredResult(result: AnalysisResult): StoredResult {
  return { matched: result.matched, missing: result.missing, bullets: result.bullets, tips: result.tips };
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function toDetail(row: AnalysisRow): AnalysisDetail {
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    cvText: row.cv_text,
    jobText: row.job_text,
    score: row.score,
    matched: row.result.matched as Keyword[],
    missing: row.result.missing as Keyword[],
    bullets: row.result.bullets as Bullet[],
    tips: row.result.tips,
    rewrite: row.rewrite,
  };
}

function toSummary(row: AnalysisRow): AnalysisSummary {
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    score: row.score,
    matchedCount: row.result.matched.length,
    missingCount: row.result.missing.length,
    topMissing: row.result.missing.slice(0, TOP_MISSING_COUNT).map((keyword) => keyword.term),
  };
}
