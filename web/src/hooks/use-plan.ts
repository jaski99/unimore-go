'use client';

import { useCallback, useRef, useState } from 'react';
import type { PlanRequest, PlanResponse } from '@/lib/api/types';
import type { PlanService } from '@/lib/api/plan-service';

export type PlanStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

/**
 * One planner query at a time. Responses that arrive after a newer submit
 * (or a reset) are dropped, so Back/Forward and quick re-submits never show
 * a stale result.
 */
export function usePlan(service: PlanService) {
  const [status, setStatus] = useState<PlanStatus>('idle');
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<PlanRequest | null>(null);
  const sequence = useRef(0);

  const submit = useCallback(
    async (request: PlanRequest) => {
      const id = ++sequence.current;
      setLastRequest(request);
      setStatus('loading');
      setError(null);
      try {
        const response = await service.createPlan(request);
        if (id !== sequence.current) return;
        setResult(response);
        setStatus(response.itineraries.length ? 'success' : 'empty');
      } catch (cause) {
        if (id !== sequence.current) return;
        setResult(null);
        setError(cause instanceof Error ? cause.message : 'Si è verificato un errore imprevisto.');
        setStatus('error');
      }
    },
    [service],
  );

  const retry = useCallback(() => {
    if (lastRequest) void submit(lastRequest);
  }, [lastRequest, submit]);

  /** Back to "no search yet" (e.g. Back to a URL without a search). */
  const reset = useCallback(() => {
    sequence.current += 1;
    setStatus('idle');
    setResult(null);
    setError(null);
    setLastRequest(null);
  }, []);

  return { status, result, error, lastRequest, submit, retry, reset };
}
