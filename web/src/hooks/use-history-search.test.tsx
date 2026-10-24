import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareUrl, useHistorySearch } from './use-history-search';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('useHistorySearch', () => {
  it('aggiunge una voce alla cronologia solo se la ricerca cambia', () => {
    const { result } = renderHook(() => useHistorySearch(vi.fn()));
    const before = window.history.length;
    act(() => result.current.push('sede=dief&ora=08%3A30'));
    expect(window.location.search).toBe('?sede=dief&ora=08%3A30');
    expect(window.history.length).toBe(before + 1);
    act(() => result.current.push('sede=dief&ora=08%3A30'));
    expect(window.history.length).toBe(before + 1);
  });

  it('avvisa a ogni Indietro/Avanti con la ricerca corrente', () => {
    const onNavigate = vi.fn();
    const { unmount } = renderHook(() => useHistorySearch(onNavigate));
    window.history.replaceState(null, '', '/?sede=economia_biagi');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(onNavigate).toHaveBeenCalledWith('?sede=economia_biagi');
    unmount();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('costruisce il link assoluto da condividere', () => {
    expect(shareUrl('sede=dief')).toBe(`${window.location.origin}/?sede=dief`);
    expect(shareUrl('')).toBe(`${window.location.origin}/`);
  });
});
