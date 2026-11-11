export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const MAX_TEXT_LENGTH = 8000;
export const PAGE_SIZE = 10;

export interface Keyword {
  term: string;
  weight: number;
}

export interface Bullet {
  index: number;
  text: string;
}

export interface RewrittenBullet {
  index: number;
  original: string;
  improved: string;
}

export interface AnalysisDetail {
  id: number;
  createdAt: string;
  score: number;
  matched: Keyword[];
  missing: Keyword[];
  bullets: Bullet[];
  tips: string[];
  cvText: string;
  jobText: string;
  rewrite: { createdAt: string; bullets: RewrittenBullet[] } | null;
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
  source: 'ai' | 'algorithm';
  bullets: RewrittenBullet[];
  tips: string[];
}

export interface Capabilities {
  ai: boolean;
}

export interface HealthStatus {
  status: string;
  db: 'up' | 'down' | 'disabled';
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Calls the API and turns every failure into an ApiError with a message a person can read. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Could not reach the ResumeLens API. Check that it is running.', 0);
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(messageFrom(body, response.status), response.status);
  return body as T;
}

function messageFrom(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(' ');
  return `Request failed with status ${status}.`;
}

/** Client-side check mirrored from the API so people get feedback before a round trip. */
export function validateTexts(cvText: string, jobText: string): string | null {
  if (cvText.trim() === '') return 'Paste your CV text to continue.';
  if (jobText.trim() === '') return 'Paste the job description to continue.';
  if (cvText.length > MAX_TEXT_LENGTH) return `Your CV is over ${MAX_TEXT_LENGTH} characters. Shorten it to continue.`;
  if (jobText.length > MAX_TEXT_LENGTH) return `The job description is over ${MAX_TEXT_LENGTH} characters. Shorten it to continue.`;
  return null;
}
