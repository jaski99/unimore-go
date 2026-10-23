import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { memoryStorage } from '@/test/memory-storage';
import { usePlannerValues } from './use-planner-values';

const PREFS = 'unimorego.planner.v1';
const SCHEDULE = 'unimorego.schedule.v1';
// Monday 26/10/2026 09:00 in Rome.
const now = () => new Date('2026-10-26T08:00:00Z');

describe('usePlannerValues', () => {
  it('parte dai valori predefiniti di oggi e salva ogni modifica', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => usePlannerValues(() => storage, now));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values.date).toBe('2026-10-26');
    expect(result.current.prefill).toBeNull();
    act(() => result.current.update({ mode: 'walk', stationBufferMin: 7 }));
    expect(result.current.values).toMatchObject({ mode: 'walk', stationBufferMin: 7 });
    await waitFor(() =>
      expect(JSON.parse(storage.data[PREFS])).toMatchObject({ mode: 'walk', stationBufferMin: 7 }),
    );
  });

  it('ripristina le preferenze salvate', async () => {
    const storage = memoryStorage({
      [PREFS]: JSON.stringify({ mode: 'walk', regionalOnly: false, stationId: 'modena_fs' }),
    });
    const { result } = renderHook(() => usePlannerValues(() => storage, now));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values).toMatchObject({
      mode: 'walk',
      regionalOnly: false,
      stationId: 'modena_fs',
      date: '2026-10-26',
    });
  });

  it('precompila la prossima lezione di oggi dall’orario settimanale', async () => {
    const storage = memoryStorage({
      [PREFS]: JSON.stringify({ direction: 'return', campusId: 'dief' }),
      [SCHEDULE]: JSON.stringify([
        { id: 'x', weekday: 1, time: '11:00', campusId: 'economia_biagi' },
      ]),
    });
    const { result } = renderHook(() => usePlannerValues(() => storage, now));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values).toMatchObject({
      direction: 'outbound',
      campusId: 'economia_biagi',
      date: '2026-10-26',
      time: '11:00',
    });
    expect(result.current.prefill).toMatchObject({ today: true, date: '2026-10-26' });
  });

  it('funziona anche senza storage (SSR o privacy)', async () => {
    const { result } = renderHook(() => usePlannerValues(() => null, now));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values.campusId).toBe('dief');
  });
});
