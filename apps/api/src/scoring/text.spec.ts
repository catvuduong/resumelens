import { canonicalKey, isContentToken, normalise, stem, tokenize } from './text.js';
import { SKILL_TERMS, synonymOf } from './synonyms.js';

describe('normalise', () => {
  it('lowercases and strips accents', () => {
    expect(normalise('Café RÉSUMÉ')).toBe('cafe resume');
  });

  it('keeps symbol-heavy names as single tokens', () => {
    expect(normalise('C++ and C#')).toContain('cpp');
    expect(normalise('C++ and C#')).toContain('csharp');
    expect(normalise('Node.js and Vue.js')).toBe('nodejs and vuejs');
  });
});

describe('tokenize', () => {
  it('splits on punctuation and whitespace', () => {
    expect(tokenize('Built REST-APIs, CI/CD pipelines!')).toEqual(['built', 'rest', 'apis', 'ci', 'cd', 'pipelines']);
  });

  it('returns an empty list for blank input', () => {
    expect(tokenize('   \n\t ')).toEqual([]);
    expect(tokenize('!!! ---')).toEqual([]);
  });
});

describe('stem', () => {
  it('folds plurals and leaves short or -ss/-us/-is words alone', () => {
    expect(stem('pipelines')).toBe('pipeline');
    expect(stem('libraries')).toBe('library');
    expect(stem('tests')).toBe('test');
    expect(stem('class')).toBe('class');
    expect(stem('status')).toBe('status');
    expect(stem('analysis')).toBe('analysis');
    expect(stem('sql')).toBe('sql');
  });
});

describe('synonyms', () => {
  it.each([
    ['js', 'javascript'],
    ['javascript', 'javascript'],
    ['ecmascript', 'javascript'],
    ['node', 'nodejs'],
    ['nodejs', 'nodejs'],
    ['k8s', 'kubernetes'],
    ['kubernetes', 'kubernetes'],
    ['postgres', 'postgresql'],
    ['psql', 'postgresql'],
    ['ml', 'machinelearning'],
    ['visualization', 'visualisation'],
  ])('maps %s to %s', (alias, canonical) => {
    expect(canonicalKey(alias)).toBe(canonical);
  });

  it('treats synonym keys as skills', () => {
    expect(SKILL_TERMS.has('kubernetes')).toBe(true);
    expect(SKILL_TERMS.has('k8s')).toBe(false);
  });

  it('returns undefined for tokens outside the map', () => {
    expect(synonymOf('gardening')).toBeUndefined();
  });

  it('applies stemming to words that are not in the map', () => {
    expect(canonicalKey('pipelines')).toBe('pipeline');
  });
});

describe('isContentToken', () => {
  it('rejects stop words, bare numbers and single characters', () => {
    expect(isContentToken('the')).toBe(false);
    expect(isContentToken('experience')).toBe(false);
    expect(isContentToken('2024')).toBe(false);
    expect(isContentToken('c')).toBe(false);
  });

  it('accepts real terms', () => {
    expect(isContentToken('kubernetes')).toBe(true);
    expect(isContentToken('k8s')).toBe(true);
  });
});
