/** Runtime configuration of the API client, resolved from NEXT_PUBLIC_* env vars. */

export const DEFAULT_API_URL = 'http://localhost:8000';

export interface ApiConfig {
  /**
   * Base URL of the FastAPI backend, without trailing slash. An empty string
   * (from NEXT_PUBLIC_API_URL=/) means same-origin requests via the Next.js proxy.
   */
  apiUrl: string;
  /** True only when NEXT_PUBLIC_USE_MOCK=1: use the offline mock instead of HTTP. */
  useMock: boolean;
}

export interface ApiEnv {
  NEXT_PUBLIC_API_URL?: string;
  NEXT_PUBLIC_USE_MOCK?: string;
}

export function resolveApiConfig(env: ApiEnv): ApiConfig {
  const rawUrl = env.NEXT_PUBLIC_API_URL?.trim();
  return {
    apiUrl: (rawUrl || DEFAULT_API_URL).replace(/\/+$/, ''),
    useMock: env.NEXT_PUBLIC_USE_MOCK?.trim() === '1',
  };
}

// Next.js inlines NEXT_PUBLIC_* only for static `process.env.X` references.
export const apiConfig: ApiConfig = resolveApiConfig({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK,
});
