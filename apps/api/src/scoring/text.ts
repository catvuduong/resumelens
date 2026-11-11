import { STOP_WORDS } from './stop-words.js';
import { synonymOf } from './synonyms.js';

/**
 * Lowercases, strips accents and rewrites a few symbol-heavy names so they survive tokenising:
 * "C++" -> "cpp", "C#" -> "csharp", "Node.js" -> "nodejs".
 */
export function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/c\+\+/g, ' cpp ')
    .replace(/c#/g, ' csharp ')
    .replace(/\.js\b/g, 'js')
    .replace(/\.net\b/g, 'net');
}

/** Splits normalised text into letter/digit tokens. */
export function tokenize(text: string): string[] {
  return normalise(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Light plural stemming so "pipelines" and "pipeline" compare equal. Deliberately conservative. */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !/(ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

/** Maps a token to its comparison key: synonym canonical name first, otherwise the stemmed token. */
export function canonicalKey(token: string): string {
  const direct = synonymOf(token);
  if (direct) return direct;
  const stemmed = stem(token);
  return synonymOf(stemmed) ?? stemmed;
}

/** True for tokens that can be a keyword: not a stop word, not a bare number, not a single character. */
export function isContentToken(token: string): boolean {
  return token.length >= 2 && !/^\d+$/.test(token) && !STOP_WORDS.has(token);
}
