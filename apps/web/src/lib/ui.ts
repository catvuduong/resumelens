export type Theme = 'light' | 'dark';

const THEME_KEY = 'resumelens-theme';

/** The colour theme in effect right now: an explicit choice, otherwise the system preference. */
export function readTheme(): Theme {
  try {
    const attr = document.documentElement.dataset.theme;
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Applies a theme and remembers it. Storage can be blocked, so a failed write is ignored. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies for this page view.
  }
}

/** Inline script run before paint so a remembered theme does not flash. Kept free of imports on purpose. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

/** A short plain-language reading of the score for the summary line. */
export function scoreVerdict(score: number): string {
  if (score >= 80) return 'Strong match';
  if (score >= 50) return 'Partial match';
  return 'Weak match';
}
