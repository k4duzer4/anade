import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  // As artes locais são servidas pelo CDN; a rota de otimização retorna 404 nos Services.
  images: { unoptimized: true },
  async rewrites() {
    // Na Vercel, o roteamento público é definido pelos Services em vercel.json.
    if (process.env.VERCEL === '1') return [];
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
          {
            key: 'Content-Security-Policy',
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
