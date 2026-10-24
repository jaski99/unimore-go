import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlanService } from '@/lib/api/plan-service';
import type { PlanRequest, PlanResponse } from '@/lib/api/types';
import { usePlan } from './use-plan';

const request: PlanRequest = {
  origin: { station_id: 'reggio_fs' },
  campus_id: 'dief',
  arrive_by: '2026-10-26T08:30:00+01:00',
  mode: 'bike',
  margin_min: 10,
};
const plan: PlanResponse = { itineraries: [], warnings: [] };

function serviceWith(createPlan: PlanService['createPlan']): PlanService {
  return {
    getHealth: vi.fn(),
    getCampuses: vi.fn(),
    getStations: vi.fn(),
    geocode: vi.fn(),
    createPlan,
  };
}

describe('usePlan', () => {
  it('gestisce loading, empty e retry per l’ultima richiesta', async () => {
    const createPlan = vi.fn().mockResolvedValue(plan);
    const { result } = renderHook(() => usePlan(serviceWith(createPlan)));
    await act(async () => {
      await result.current.submit(request);
    });
    expect(result.current.status).toBe('empty');
    expect(result.current.lastRequest).toEqual(request);
    expect(result.current.result).toEqual(plan);
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(createPlan).toHaveBeenCalledTimes(2));
  });

  it('traduce un errore del servizio in stato error con messaggio', async () => {
    const { result } = renderHook(() =>
      usePlan(serviceWith(vi.fn().mockRejectedValue(new Error('Connessione non disponibile')))),
    );
    await act(async () => {
      await result.current.submit(request);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Connessione non disponibile');
  });
});

describe('usePlan: risposte fuori ordine e reset', () => {
  it('ignora la risposta di una richiesta superata da una più recente', async () => {
    let resolveSlow!: (value: PlanResponse) => void;
    const slow = new Promise<PlanResponse>((resolve) => (resolveSlow = resolve));
    const fresh: PlanResponse = { itineraries: [], warnings: ['fresh'] };
    const createPlan = vi.fn().mockReturnValueOnce(slow).mockResolvedValueOnce(fresh);
    const { result } = renderHook(() => usePlan(serviceWith(createPlan)));
    let first!: Promise<void>;
    act(() => {
      first = result.current.submit(request);
    });
    await act(() => result.current.submit({ ...request, mode: 'walk' }));
    await act(async () => {
      resolveSlow({ itineraries: [], warnings: ['stale'] });
      await first;
    });
    expect(result.current.result?.warnings).toEqual(['fresh']);
    expect(result.current.lastRequest?.mode).toBe('walk');
  });

  it('reset torna allo stato iniziale e scarta la richiesta in corso', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<PlanResponse>((_, fail) => (reject = fail));
    const { result } = renderHook(() => usePlan(serviceWith(vi.fn().mockReturnValue(pending))));
    let call!: Promise<void>;
    act(() => {
      call = result.current.submit(request);
    });
    expect(result.current.status).toBe('loading');
    act(() => result.current.reset());
    await act(async () => {
      reject(new Error('rete'));
      await call;
    });
    expect(result.current).toMatchObject({
      status: 'idle',
      result: null,
      error: null,
      lastRequest: null,
    });
  });
});
