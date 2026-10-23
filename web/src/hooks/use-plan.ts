'use client';

import { useCallback, useState } from 'react';
import type { PlanRequest, PlanResponse } from '@/lib/api/types';
import type { PlanService } from '@/lib/api/plan-service';

export type PlanStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export function usePlan(service: PlanService) {
  const [status, setStatus] = useState<PlanStatus>('idle');
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<PlanRequest | null>(null);

  const submit = useCallback(
    async (request: PlanRequest) => {
      setLastRequest(request);
      setStatus('loading');
      setError(null);
      try {
        const response = await service.createPlan(request);
        setResult(response);
        setStatus(response.itineraries.length ? 'success' : 'empty');
      } catch (cause) {
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

  return { status, result, error, submit, retry };
}
