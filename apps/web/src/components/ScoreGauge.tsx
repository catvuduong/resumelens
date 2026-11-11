'use client';

import { CSSProperties, useEffect, useState } from 'react';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ANIMATION_MS = 900;

/** Large circular gauge that animates from 0 to the score. The final value is also in the aria-label. */
export function ScoreGauge({ score }: { score: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 0 : ANIMATION_MS;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(score * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const offset = CIRCUMFERENCE * (1 - shown / 100);

  return (
    <div className="gauge">
      <svg viewBox="0 0 120 120" className="gauge-svg" role="img" aria-label={`Match score ${score} out of 100`}>
        <circle className="gauge-track" cx="60" cy="60" r={RADIUS} />
        <circle
          className="gauge-progress"
          cx="60"
          cy="60"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="gauge-center" aria-hidden="true">
        <span className="gauge-value" data-testid="score-value">
          {shown}
        </span>
        <span className="gauge-unit">/ 100</span>
      </div>
    </div>
  );
}

/** Compact conic-gradient ring for list rows. Static, so it renders without client state. */
export function ScoreRing({ score }: { score: number }) {
  const style = { '--value': Math.max(0, Math.min(100, score)) } as CSSProperties;
  return (
    <div className="ring" style={style} role="img" aria-label={`Score ${score} out of 100`}>
      <span aria-hidden="true">{score}</span>
    </div>
  );
}
