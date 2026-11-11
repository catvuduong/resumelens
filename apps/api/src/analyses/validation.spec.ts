import { BadRequestException } from '@nestjs/common';
import { MAX_TEXT_LENGTH, parseId, parsePagination, validateAnalysisInput } from './validation.js';

function errorBody(fn: () => unknown): { message: string[] } {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return (err as BadRequestException).getResponse() as { message: string[] };
  }
  throw new Error('expected a BadRequestException');
}

describe('validateAnalysisInput', () => {
  it('accepts two non-empty texts', () => {
    expect(validateAnalysisInput({ cvText: 'CV', jobText: 'Job' })).toEqual({ cvText: 'CV', jobText: 'Job' });
  });

  it('rejects missing, blank and non-string fields with a message per field', () => {
    const body = errorBody(() => validateAnalysisInput({ cvText: '   ', jobText: 42 }));
    expect(body.message).toEqual(['cvText must not be empty', 'jobText must be a string']);
  });

  it('reports a missing body', () => {
    const body = errorBody(() => validateAnalysisInput(undefined));
    expect(body.message).toEqual(['cvText is required', 'jobText is required']);
  });

  it('rejects texts longer than the limit', () => {
    const tooLong = 'a'.repeat(MAX_TEXT_LENGTH + 1);
    const body = errorBody(() => validateAnalysisInput({ cvText: 'ok', jobText: tooLong }));
    expect(body.message).toEqual([`jobText must be at most ${MAX_TEXT_LENGTH} characters (got 8001)`]);
  });

  it('accepts a text exactly at the limit', () => {
    const exact = 'a'.repeat(MAX_TEXT_LENGTH);
    expect(() => validateAnalysisInput({ cvText: exact, jobText: exact })).not.toThrow();
  });
});

describe('parseId', () => {
  it('accepts positive integers', () => {
    expect(parseId('42')).toBe(42);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '99999999999999999999'])('rejects %s', (raw) => {
    expect(() => parseId(raw)).toThrow(BadRequestException);
  });
});

describe('parsePagination', () => {
  it('defaults to page 1 and 10 per page', () => {
    expect(parsePagination(undefined, undefined)).toEqual({ page: 1, pageSize: 10 });
  });

  it('parses valid values', () => {
    expect(parsePagination('3', '25')).toEqual({ page: 3, pageSize: 25 });
  });

  it('rejects out-of-range or non-numeric values', () => {
    expect(() => parsePagination('0', undefined)).toThrow(BadRequestException);
    expect(() => parsePagination(undefined, '51')).toThrow(BadRequestException);
    expect(() => parsePagination('two', undefined)).toThrow(BadRequestException);
  });
});
