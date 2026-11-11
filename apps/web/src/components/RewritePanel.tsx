'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest, RewrittenBullet, RewriteResponse } from '@/lib/api';
import { errorMessage } from '@/lib/ui';

type RewriteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ai'; bullets: RewrittenBullet[] }
  | { kind: 'fallback' }
  | { kind: 'error'; message: string };

interface RewritePanelProps {
  analysisId: number;
  /** A rewrite saved with this analysis earlier, shown straight away. */
  saved: RewrittenBullet[] | null;
}

/** Only rendered when GET /capabilities reports ai: true. */
export function RewritePanel({ analysisId, saved }: RewritePanelProps) {
  const [state, setState] = useState<RewriteState>(
    saved && saved.length > 0 ? { kind: 'ai', bullets: saved } : { kind: 'idle' },
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function improve() {
    setState({ kind: 'loading' });
    try {
      const response = await apiRequest<RewriteResponse>(`/analyses/${analysisId}/rewrite`, { method: 'POST' });
      setState(response.source === 'ai' ? { kind: 'ai', bullets: response.bullets } : { kind: 'fallback' });
    } catch (err) {
      setState({ kind: 'error', message: errorMessage(err) });
    }
  }

  async function copy(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedIndex(null), 1600);
    } catch {
      setCopiedIndex(null);
    }
  }

  return (
    <section className="rewrite" aria-labelledby="rewrite-heading">
      <div className="section-head">
        <h3 id="rewrite-heading">Bullet rewrites</h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={improve} disabled={state.kind === 'loading'}>
          {state.kind === 'loading' ? 'Improving…' : 'Improve my bullets with AI'}
        </button>
      </div>

      {state.kind === 'idle' && (
        <p className="muted">
          Get a stronger version of each bullet. Every suggestion is shown next to the original so you can check it.
        </p>
      )}

      {state.kind === 'loading' && (
        <div className="skeleton-stack" aria-label="Loading rewrites" role="status">
          <div className="skeleton skeleton-block" />
          <div className="skeleton skeleton-block" />
        </div>
      )}

      {state.kind === 'ai' && (
        <>
          <p className="badge badge-ai">AI-assisted rewrite</p>
          <p className="muted small">
            Check every suggestion before you use it. The model only rephrases what is already in your CV.
          </p>
          {state.bullets.length === 0 ? (
            <p className="muted">No bullets were rewritten.</p>
          ) : (
            <ol className="rewrite-list">
              {state.bullets.map((bullet) => (
                <li key={bullet.index} className="rewrite-item">
                  <div className="rewrite-col">
                    <span className="col-label">Original · bullet {bullet.index}</span>
                    <p>{bullet.original}</p>
                  </div>
                  <div className="rewrite-col is-improved">
                    <span className="col-label">Improved</span>
                    <p>{bullet.improved}</p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm copy-btn"
                      onClick={() => copy(bullet.index, bullet.improved)}
                      aria-label={`Copy improved bullet ${bullet.index}`}
                    >
                      {copiedIndex === bullet.index ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {state.kind === 'fallback' && (
        <p className="notice" role="status">
          The AI rewrite is unavailable right now, so the rule-based tips above still apply. Try again in a minute.
        </p>
      )}

      {state.kind === 'error' && (
        <p className="alert alert-error" role="alert">
          {state.message}
        </p>
      )}
    </section>
  );
}
