/**
 * Optional same-origin proxy: when API_PROXY_TARGET is set at build time,
 * Next.js forwards /api/* to the backend, so the browser can use
 * NEXT_PUBLIC_API_URL=/ and never needs CORS (single public origin).
 */
export interface Rewrite {
  source: string;
  destination: string;
}

export function buildApiRewrites(target: string | undefined): Rewrite[] {
  const base = target?.trim().replace(/\/+$/, '');
  if (!base) return [];
  if (!/^https?:\/\//.test(base)) {
    throw new Error(`API_PROXY_TARGET deve essere un URL http(s) assoluto, ricevuto: ${target}`);
  }
  return [{ source: '/api/:path*', destination: `${base}/api/:path*` }];
}
