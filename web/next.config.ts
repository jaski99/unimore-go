import type { NextConfig } from 'next';
import { buildApiRewrites } from './src/lib/api/proxy-rewrites';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return buildApiRewrites(process.env.API_PROXY_TARGET);
  },
};

export default nextConfig;
