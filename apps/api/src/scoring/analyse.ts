import { SKILL_TERMS } from './synonyms.js';
import { STOP_WORDS } from './stop-words.js';
import { canonicalKey, isContentToken, tokenize } from './text.js';

/** Only the most frequent job terms are scored, so long postings do not dilute the score. */
export const MAX_JOB_TERMS = 40;
/** Skill terms count double compared with ordinary words that appear as often. */
const SKILL_MULTIPLIER = 2;
/** Tips are capped so the list stays readable. */
const MAX_TIPS = 15;
const MAX_BULLETS = 60;
const METRIC = /\d|%|[$€£]/;
const WEAK_START = /^(responsible for|helped|assisted|worked on|involved in|duties included|tasked with|in charge of)\b/i;
const BULLET_MARKER = /^\s*(?:[-*•·▪►–]|\d{1,2}[.)])\s+/u;

export interface Keyword {
  term: string;
  weight: number;
}

export interface Bullet {
  index: number;
  text: string;
}

export interface AnalysisResult {
  /** 0-100: weighted share of the job's keywords that also appear in the CV. */
  score: number;
  matched: Keyword[];
  /** Ranked by weight, highest first. */
  missing: Keyword[];
  bullets: Bullet[];
  tips: string[];
}

interface JobTerm extends Keyword {
  key: string;
}

/** Keywords from the job description with their weights, most important first. */
export function extractJobTerms(jobText: string): JobTerm[] {
  const groups = new Map<string, { term: string; count: number }>();
  for (const token of tokenize(jobText)) {
    if (!isContentToken(token)) continue;
    const key = canonicalKey(token);
    if (STOP_WORDS.has(key)) continue;
    const group = groups.get(key);
    if (group) group.count += 1;
    // Show the word the job used ("k8s", "ci") rather than the internal canonical key.
    else groups.set(key, { term: token, count: 1 });
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      term: group.term,
      weight: group.count * (SKILL_TERMS.has(key) ? SKILL_MULTIPLIER : 1),
    }))
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, MAX_JOB_TERMS);
}

/** Bullet lines from the CV. Marked lines win; otherwise any line with at least four words counts. */
export function extractBullets(cvText: string): string[] {
  const lines = cvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const marked = lines
    .filter((line) => BULLET_MARKER.test(line))
    .map((line) => line.replace(BULLET_MARKER, '').trim())
    .filter(Boolean);
  const source = marked.length > 0 ? marked : lines.filter((line) => tokenize(line).length >= 4);
  return source.slice(0, MAX_BULLETS);
}

/** Scores how well a CV covers a job description. Pure: no I/O, no randomness. */
export function analyseMatch(cvText: string, jobText: string): AnalysisResult {
  const cvKeys = new Set(tokenize(cvText).map(canonicalKey));
  const terms = extractJobTerms(jobText);
  const total = terms.reduce((sum, term) => sum + term.weight, 0);

  const matched: Keyword[] = [];
  const missing: Keyword[] = [];
  let matchedWeight = 0;
  for (const term of terms) {
    if (cvKeys.has(term.key)) {
      matched.push({ term: term.term, weight: term.weight });
      matchedWeight += term.weight;
    } else {
      missing.push({ term: term.term, weight: term.weight });
    }
  }

  const score = total === 0 ? 0 : Math.round((matchedWeight / total) * 100);
  const bullets = extractBullets(cvText).map((text, i) => ({ index: i + 1, text }));
  const tips = buildTips({ score, hasKeywords: terms.length > 0, missing, bullets });
  return { score, matched, missing, bullets, tips };
}

function buildTips(input: {
  score: number;
  hasKeywords: boolean;
  missing: Keyword[];
  bullets: Bullet[];
}): string[] {
  const { score, hasKeywords, missing, bullets } = input;
  const tips: string[] = [];

  if (!hasKeywords) {
    tips.push('The job description has no recognisable keywords. Paste the full posting, including the requirements.');
  } else if (score >= 80) {
    tips.push('Strong keyword coverage. Keep the job wording where it is true for you.');
  } else if (score >= 50) {
    tips.push('Decent coverage. Work the most important missing terms in where they are genuinely true for you.');
  } else {
    tips.push("Low coverage. Many of the job's key terms are missing from the CV; review the list below.");
  }

  for (const keyword of missing.slice(0, 3)) {
    tips.push(`Mention "${keyword.term}" in a bullet if you have real experience with it.`);
  }

  if (bullets.length === 0) {
    tips.push("List your achievements as separate lines starting with '-' so each one can be reviewed.");
  }

  let metricTips = 0;
  for (const bullet of bullets) {
    const words = bullet.text.split(/\s+/).length;
    if (!METRIC.test(bullet.text) && words >= 6 && metricTips < 5) {
      tips.push(`Add measurable results to bullet ${bullet.index}: a number, percentage, volume or time saved.`);
      metricTips += 1;
    }
    const weak = WEAK_START.exec(bullet.text);
    if (weak) {
      tips.push(`Start bullet ${bullet.index} with a strong action verb instead of "${weak[0]}".`);
    }
    if (words > 30) {
      tips.push(`Shorten bullet ${bullet.index} to one or two lines (it has ${words} words).`);
    }
  }

  return tips.slice(0, MAX_TIPS);
}
