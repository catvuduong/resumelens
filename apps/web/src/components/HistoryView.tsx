'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnalysisPage, AnalysisSummary, apiRequest, PAGE_SIZE } from '@/lib/api';
import { errorMessage, formatDate } from '@/lib/ui';
import { ScoreRing } from './ScoreGauge';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: AnalysisPage };

export function HistoryView() {
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AnalysisPage>(`/analyses?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  function reload() {
    setState({ kind: 'loading' });
    setReloadToken((t) => t + 1);
  }

  async function remove(item: AnalysisSummary, itemsOnPage: number) {
    setBusyId(item.id);
    setNotice(null);
    try {
      await apiRequest<void>(`/analyses/${item.id}`, { method: 'DELETE' });
      setConfirmId(null);
      setNotice(`Deleted analysis #${item.id}.`);
      // Stepping back a page keeps the list from ending up empty after the last item on a later page goes.
      if (itemsOnPage === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="history">
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p className="muted">Your saved analyses, newest first. Open one to see the full report.</p>
        </div>
        <Link href="/" className="btn btn-primary">
          New analysis
        </Link>
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {state.kind === 'loading' && (
        <ul className="history-list" aria-label="Loading history" role="status">
          {[0, 1, 2].map((i) => (
            <li key={i} className="history-card is-skeleton">
              <div className="skeleton skeleton-ring" />
              <div className="skeleton-col grow">
                <div className="skeleton skeleton-line w-60" />
                <div className="skeleton skeleton-line w-40" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {state.kind === 'error' && (
        <div className="state state-error">
          <h2>Could not load history</h2>
          <p>{state.message}</p>
          <button type="button" className="btn btn-secondary" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.data.items.length === 0 && (
        <div className="state state-empty">
          <h2>No analyses yet</h2>
          <p className="muted">Run a match and it will be saved here.</p>
          <Link href="/" className="btn btn-primary">
            Analyse a CV
          </Link>
        </div>
      )}

      {state.kind === 'ready' && state.data.items.length > 0 && (
        <>
          <ul className="history-list">
            {state.data.items.map((item) => (
              <li key={item.id} className="history-card" data-testid="analysis-card" data-id={item.id}>
                <ScoreRing score={item.score} />
                <div className="history-main">
                  <div className="history-title">
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    <span className="muted small">
                      {item.matchedCount} matched · {item.missingCount} missing
                    </span>
                  </div>
                  {item.topMissing.length > 0 ? (
                    <ul className="chip-list" aria-label="Top missing keywords">
                      {item.topMissing.slice(0, 3).map((term) => (
                        <li key={term} className="chip chip-warn">
                          {term}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">Nothing missing.</p>
                  )}
                </div>
                <div className="history-actions">
                  <Link href={`/analyses/${item.id}`} className="btn btn-secondary btn-sm">
                    Open
                  </Link>
                  {confirmId === item.id ? (
                    <div className="confirm" role="group" aria-label={`Confirm delete of analysis ${item.id}`}>
                      <span className="small">Delete this?</span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => remove(item, state.data.items.length)}
                        disabled={busyId === item.id}
                      >
                        {busyId === item.id ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm danger-text"
                      onClick={() => setConfirmId(item.id)}
                      aria-label={`Delete analysis ${item.id}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <Pager page={state.data.page} total={state.data.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="History pages">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <span className="muted small">
        Page {page} of {pages}
      </span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        Next
      </button>
    </nav>
  );
}
