'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useSyncExternalStore } from 'react';
import { applyTheme, readTheme, Theme } from '@/lib/ui';

// Follows the theme attribute on <html> and the system preference, so the label stays correct without effects.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onChange);
  };
}

export function SiteHeader() {
  const theme: Theme = useSyncExternalStore(subscribeToTheme, readTheme, () => 'light');

  function toggleTheme() {
    applyTheme(readTheme() === 'dark' ? 'light' : 'dark');
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="ResumeLens home">
          <span className="brand-mark" aria-hidden="true">RL</span>
          <span className="brand-name">ResumeLens</span>
        </Link>
        <Suspense fallback={<NavLinks current={null} />}>
          <ActiveNav />
        </Suspense>
        <button
          type="button"
          className="btn btn-ghost btn-sm theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}

// Reads the current path, which is only known at request time, so it sits behind a Suspense boundary.
function ActiveNav() {
  const pathname = usePathname();
  return <NavLinks current={pathname.startsWith('/history') ? 'history' : 'analyse'} />;
}

function NavLinks({ current }: { current: 'analyse' | 'history' | null }) {
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" className={`nav-link${current === 'analyse' ? ' is-active' : ''}`} aria-current={current === 'analyse' ? 'page' : undefined}>
        Analyse
      </Link>
      <Link href="/history" className={`nav-link${current === 'history' ? ' is-active' : ''}`} aria-current={current === 'history' ? 'page' : undefined}>
        History
      </Link>
    </nav>
  );
}
