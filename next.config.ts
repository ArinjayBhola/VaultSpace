import type { NextConfig } from 'next';
const config: NextConfig = {
  logging: { incomingRequests: { ignore: [/\/api\/public\//, /\/s\//] } },
  serverExternalPackages: ['sharp', 'pdfjs-dist', '@napi-rs/canvas'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};
export default config;
