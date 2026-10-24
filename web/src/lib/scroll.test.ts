import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollBehavior, scrollToElement } from './scroll';

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)',
      media: query,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('scroll', () => {
  it('scorre in modo fluido di default', () => {
    mockReducedMotion(false);
    expect(scrollBehavior()).toBe('smooth');
  });

  it('rispetta prefers-reduced-motion', () => {
    mockReducedMotion(true);
    expect(scrollBehavior()).toBe('auto');
  });

  it('porta l’elemento in cima alla vista', () => {
    mockReducedMotion(true);
    document.body.innerHTML = '<div id="result"></div>';
    const target = document.getElementById('result')!;
    target.scrollIntoView = vi.fn();
    scrollToElement('result');
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(() => scrollToElement('missing')).not.toThrow();
  });
});
