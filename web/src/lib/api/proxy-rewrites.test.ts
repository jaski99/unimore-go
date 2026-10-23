import { describe, expect, it } from 'vitest';
import { buildApiRewrites } from './proxy-rewrites';

describe('buildApiRewrites', () => {
  it('non aggiunge rewrite senza API_PROXY_TARGET', () => {
    expect(buildApiRewrites(undefined)).toEqual([]);
    expect(buildApiRewrites('  ')).toEqual([]);
  });

  it('inoltra /api/* al backend indicato', () => {
    expect(buildApiRewrites('http://127.0.0.1:8000/')).toEqual([
      { source: '/api/:path*', destination: 'http://127.0.0.1:8000/api/:path*' },
    ]);
  });

  it('rifiuta valori non assoluti', () => {
    expect(() => buildApiRewrites('localhost:8000')).toThrow('API_PROXY_TARGET');
  });
});
