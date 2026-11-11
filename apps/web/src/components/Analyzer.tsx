'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AnalysisDetail, apiRequest, Capabilities, MAX_TEXT_LENGTH, validateTexts } from '@/lib/api';
import { SAMPLE_CV, SAMPLE_JOB } from '@/lib/sample';
import { errorMessage } from '@/lib/ui';
import { ResultPanel, ResultView } from './ResultPanel';

interface AnalyzerProps {
  /** Set on /analyses/[id]: the saved analysis to load into the page. */
  analysisId?: string;
}

export function Analyzer({ analysisId }: AnalyzerProps) {
  const [cvText, setCvText] = useState('');
  const [jobText, setJobText] = useState('');
  const [view, setView] = useState<ResultView>(analysisId ? { kind: 'loading' } : { kind: 'empty' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ai, setAi] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // The AI button only appears when the API reports a configured key. A failed lookup just hides it.
  useEffect(() => {
    let cancelled = false;
    apiRequest<Capabilities>('/capabilities')
      .then((caps) => {
        if (!cancelled) setAi(caps.ai);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Loads a saved analysis when the page is opened from history.
  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;
    apiRequest<AnalysisDetail>(`/analyses/${encodeURIComponent(analysisId)}`)
      .then((analysis) => {
        if (cancelled) return;
        setCvText(analysis.cvText);
        setJobText(analysis.jobText);
        setView({ kind: 'ready', analysis });
      })
      .catch((err: unknown) => {
        if (!cancelled) setView({ kind: 'error', message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId, reloadToken]);

  async function analyse() {
    const problem = validateTexts(cvText, jobText);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    setView({ kind: 'loading' });
    try {
      const analysis = await apiRequest<AnalysisDetail>('/analyses', {
        method: 'POST',
        body: JSON.stringify({ cvText, jobText }),
      });
      setView({ kind: 'ready', analysis });
    } catch (err) {
      setView({ kind: 'error', message: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyse();
  }

  function retry() {
    if (analysisId) setReloadToken((t) => t + 1);
    else void analyse();
  }

  function loadSample() {
    setCvText(SAMPLE_CV);
    setJobText(SAMPLE_JOB);
    setFormError(null);
  }

  function clear() {
    setCvText('');
    setJobText('');
    setFormError(null);
    setView({ kind: 'empty' });
  }

  return (
    <div className="analyzer">
      <section className="card input-card" aria-labelledby="inputs-heading">
        <div className="section-head">
          <div>
            <h1 id="inputs-heading">Match a CV to a job</h1>
            <p className="muted">Paste both texts, then see what the job asks for and what your CV is missing.</p>
          </div>
          {analysisId && (
            <Link href="/" className="btn btn-ghost btn-sm">
              New analysis
            </Link>
          )}
        </div>

        <p className="privacy-note">
          <strong>Privacy:</strong> use fictional or anonymised text. Do not paste real personal information such as
          your address, phone number, ID or bank details.
        </p>

        <form onSubmit={onSubmit} className="analyzer-form" noValidate>
          <TextField id="cv-text" label="CV" value={cvText} onChange={setCvText} placeholder="Paste the CV text here. Put each achievement on its own line, starting with “-”." />
          <TextField id="job-text" label="Job description" value={jobText} onChange={setJobText} placeholder="Paste the job description here." />

          {formError && (
            <p className="alert alert-error" role="alert">
              {formError}
            </p>
          )}

          <div className="form-actions">
            <div className="form-secondary">
              <button type="button" className="btn btn-secondary" onClick={loadSample}>
                Load sample
              </button>
              <button type="button" className="btn btn-ghost" onClick={clear} disabled={cvText === '' && jobText === ''}>
                Clear
              </button>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Analysing…' : 'Analyse match'}
            </button>
          </div>
        </form>
      </section>

      <section className="card result-card" aria-live="polite" aria-label="Result">
        <ResultPanel view={view} ai={ai} onRetry={retry} />
      </section>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const over = value.length > MAX_TEXT_LENGTH;
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <span className={`counter${over ? ' is-over' : ''}`}>
          {value.length.toLocaleString('en-GB')} / {MAX_TEXT_LENGTH.toLocaleString('en-GB')}
        </span>
      </div>
      <textarea
        id={id}
        className="textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={11}
        spellCheck={false}
        aria-invalid={over || undefined}
      />
    </div>
  );
}
