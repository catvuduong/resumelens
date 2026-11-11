'use client';

import { useEffect, useState } from 'react';
import { apiRequest, HealthStatus } from '@/lib/api';

export function SiteFooter() {
  const [health, setHealth] = useState('checking...');

  useEffect(() => {
    apiRequest<HealthStatus>('/health')
      .then((h) => setHealth(`api ${h.status} · db ${h.db}`))
      .catch(() => setHealth('api unreachable'));
  }, []);

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>Scores and keyword tips are computed by rules, so the core analysis works without any AI key.</p>
        <p data-testid="health" className="health">
          {health}
        </p>
      </div>
    </footer>
  );
}
