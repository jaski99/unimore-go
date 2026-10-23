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
