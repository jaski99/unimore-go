import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedFlag } from './use-delayed-flag';

describe('useDelayedFlag (round 5, punto 5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('diventa vero solo dopo il ritardo, e torna falso appena l’attesa finisce', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 500), {
      initialProps: { active: true },
    });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('un’attesa breve non lo accende mai; una nuova attesa riparte da zero', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 500), {
      initialProps: { active: true },
    });
    act(() => vi.advanceTimersByTime(300));
    rerender({ active: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
    rerender({ active: true });
    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe(false);
  });
});
