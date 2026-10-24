'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Keeps the planner search in the browser history: `push` adds an entry for a
 * new search (skipped when the query is unchanged, so re-submitting does not
 * stack duplicates) and `onNavigate` receives the query on Back/Forward.
 */
export function useHistorySearch(onNavigate: (search: string) => void) {
  const handler = useRef(onNavigate);
  useEffect(() => {
    handler.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    const listener = () => handler.current(window.location.search);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  const push = useCallback((query: string) => {
    const search = query ? `?${query}` : '';
    if (window.location.search === search) return;
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, []);

  return { push };
}

/** Absolute URL of the current page with `query` (for "Copia link"). */
export function shareUrl(query: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
}
