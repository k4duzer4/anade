import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: process.env.ANADE_CLOUDFLARE === '1' },
  async rewrites() {
    if (process.env.ANADE_CLOUDFLARE === '1') return [];
    const backend = process.env.API_ORIGIN || 'http://127.0.0.1:3001';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/auth/:path*', destination: `${backend}/auth/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
