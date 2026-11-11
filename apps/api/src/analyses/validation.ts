import { BadRequestException } from '@nestjs/common';

export const MAX_TEXT_LENGTH = 8000;
export const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const MAX_INT = 2_147_483_647;

export interface AnalysisInput {
  cvText: string;
  jobText: string;
}

/** Checks a POST /analyses body. Throws a 400 listing every problem found. */
export function validateAnalysisInput(body: unknown): AnalysisInput {
  const errors: string[] = [];
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const cvText = checkText('cvText', record.cvText, errors);
  const jobText = checkText('jobText', record.jobText, errors);
  if (errors.length > 0) throw new BadRequestException({ statusCode: 400, message: errors, error: 'Bad Request' });
  return { cvText: cvText!, jobText: jobText! };
}

function checkText(field: string, value: unknown, errors: string[]): string | undefined {
  if (value === undefined || value === null) {
    errors.push(`${field} is required`);
    return undefined;
  }
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`);
    return undefined;
  }
  if (value.trim().length === 0) {
    errors.push(`${field} must not be empty`);
    return undefined;
  }
  if (value.length > MAX_TEXT_LENGTH) {
    errors.push(`${field} must be at most ${MAX_TEXT_LENGTH} characters (got ${value.length})`);
    return undefined;
  }
  return value;
}

/** Parses the :id path parameter. Anything that is not a positive integer is a 400. */
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1 || id > MAX_INT) {
    throw new BadRequestException(`id must be a positive integer (got "${raw}")`);
  }
  return id;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

/** Parses ?page and ?pageSize for the history list. Missing values take defaults. */
export function parsePagination(page: unknown, pageSize: unknown): Pagination {
  const parsedPage = parseIntParam('page', page, 1, MAX_INT, 1);
  const parsedSize = parseIntParam('pageSize', pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  return { page: parsedPage, pageSize: parsedSize };
}

function parseIntParam(name: string, raw: unknown, min: number, max: number, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || value < min || value > max) {
    throw new BadRequestException(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}
