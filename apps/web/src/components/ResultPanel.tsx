'use client';

import Link from 'next/link';
import { AnalysisDetail, Keyword } from '@/lib/api';
import { formatDate, scoreVerdict } from '@/lib/ui';
import { RewritePanel } from './RewritePanel';
import { ScoreGauge } from './ScoreGauge';

export type ResultView =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; analysis: AnalysisDetail };

interface ResultPanelProps {
  view: ResultView;
  ai: boolean;
  onRetry: () => void;
}

export function ResultPanel({ view, ai, onRetry }: ResultPanelProps) {
  if (view.kind === 'loading') return <ResultSkeleton />;

  if (view.kind === 'error') {
    return (
      <div className="state state-error">
        <h2 id="result-heading">Could not complete that</h2>
        <p>{view.message}</p>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (view.kind === 'empty') {
    return (
      <div className="state state-empty">
        <div className="empty-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 id="result-heading">Your match report appears here</h2>
        <ol className="steps">
          <li>Paste a CV and a job description, or load the sample.</li>
          <li>Run the analysis to get a 0–100 score.</li>
          <li>Review the keyword gaps and bullet tips.</li>
        </ol>
      </div>
    );
  }

  return <Report analysis={view.analysis} ai={ai} />;
}

function Report({ analysis, ai }: { analysis: AnalysisDetail; ai: boolean }) {
  const { matched, missing, bullets, tips } = analysis;
  return (
    <div className="report" key={analysis.id}>
      <div className="section-head">
        <div>
          <h2 id="result-heading">Match report</h2>
          <p className="muted small">
            <time dateTime={analysis.createdAt}>{formatDate(analysis.createdAt)}</time>
          </p>
        </div>
        <span className="badge badge-algo" title="Scores, keywords and tips come from fixed rules, not from AI.">
          Algorithmic analysis
        </span>
      </div>

      <div className="score-row">
        <ScoreGauge score={analysis.score} />
        <div className="score-summary">
          <p className="verdict">{scoreVerdict(analysis.score)}</p>
          <dl className="stats">
            <div>
              <dt>Matched</dt>
              <dd>{matched.length}</dd>
            </div>
            <div>
              <dt>Missing</dt>
              <dd>{missing.length}</dd>
            </div>
            <div>
              <dt>Bullets</dt>
              <dd>{bullets.length}</dd>
            </div>
          </dl>
          <Link href={`/analyses/${analysis.id}`} className="text-link">
            Open saved analysis #{analysis.id}
          </Link>
        </div>
      </div>

      <KeywordBlock title="Matched keywords" hint="already in your CV" keywords={matched} tone="good" empty="None of the job's keywords appear in your CV yet." />
      <KeywordBlock title="Missing keywords" hint="ranked by importance" keywords={missing} tone="warn" empty="Nothing missing: every keyword is covered." />

      <section className="tips-block" aria-labelledby="tips-heading">
        <h3 id="tips-heading">Tips</h3>
        {tips.length === 0 ? (
          <p className="muted">No tips for this match.</p>
        ) : (
          <ul className="tips">
            {tips.map((tip, i) => (
              <li key={`${i}-${tip}`}>{tip}</li>
            ))}
          </ul>
        )}
      </section>

      {ai && <RewritePanel key={analysis.id} analysisId={analysis.id} saved={analysis.rewrite?.bullets ?? null} />}
    </div>
  );
}

function KeywordBlock({
  title,
  hint,
  keywords,
  tone,
  empty,
}: {
  title: string;
  hint: string;
  keywords: Keyword[];
  tone: 'good' | 'warn';
  empty: string;
}) {
  return (
    <section className="keyword-block">
      <div className="section-head">
        <h3>{title}</h3>
        <span className="muted small">{hint}</span>
      </div>
      {keywords.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="chip-list" aria-label={title}>
          {keywords.map((k) => (
            <li key={k.term} className={`chip chip-${tone}`}>
              {k.term}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultSkeleton() {
  return (
    <div className="skeleton-stack" role="status" aria-label="Analysing">
      <div className="skeleton-row">
        <div className="skeleton skeleton-ring" />
        <div className="skeleton-col">
          <div className="skeleton skeleton-line w-60" />
          <div className="skeleton skeleton-line w-40" />
          <div className="skeleton skeleton-line w-80" />
        </div>
      </div>
      <div className="skeleton skeleton-line w-40" />
      <div className="skeleton-chips">
        <span className="skeleton skeleton-chip" />
        <span className="skeleton skeleton-chip" />
        <span className="skeleton skeleton-chip" />
        <span className="skeleton skeleton-chip" />
      </div>
      <div className="skeleton skeleton-line w-40" />
      <div className="skeleton-chips">
        <span className="skeleton skeleton-chip" />
        <span className="skeleton skeleton-chip" />
        <span className="skeleton skeleton-chip" />
      </div>
    </div>
  );
}
