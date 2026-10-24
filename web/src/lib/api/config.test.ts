import { describe, expect, it } from 'vitest';
import { DEFAULT_API_URL, resolveApiConfig } from './config';

describe('resolveApiConfig', () => {
  it('usa http://localhost:8000 e la vera API per impostazione predefinita', () => {
    expect(resolveApiConfig({})).toEqual({ apiUrl: DEFAULT_API_URL, useMock: false });
    expect(DEFAULT_API_URL).toBe('http://localhost:8000');
    expect(resolveApiConfig({ NEXT_PUBLIC_API_URL: '  ' }).apiUrl).toBe(DEFAULT_API_URL);
  });

  it('legge NEXT_PUBLIC_API_URL rimuovendo lo slash finale', () => {
    expect(resolveApiConfig({ NEXT_PUBLIC_API_URL: 'https://api.example.test/' }).apiUrl).toBe(
      'https://api.example.test',
    );
  });

  it('accetta "/" per chiamare la stessa origine (proxy Next.js)', () => {
    expect(resolveApiConfig({ NEXT_PUBLIC_API_URL: '/' }).apiUrl).toBe('');
  });

  it('attiva il mock solo con NEXT_PUBLIC_USE_MOCK=1', () => {
    expect(resolveApiConfig({ NEXT_PUBLIC_USE_MOCK: '1' }).useMock).toBe(true);
    for (const value of ['0', 'true', 'mock', '']) {
      expect(resolveApiConfig({ NEXT_PUBLIC_USE_MOCK: value }).useMock).toBe(false);
    }
  });
});
