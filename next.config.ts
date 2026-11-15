import type { NextConfig } from 'next';
const config: NextConfig = {
  logging: { incomingRequests: { ignore: [/\/api\/public\//, /\/s\//] } },
  serverExternalPackages: ['sharp', 'pdfjs-dist', '@napi-rs/canvas'],
  // PDF.js loads its server worker and rendering assets dynamically. They are
  // otherwise absent from the serverless function's dependency trace.
  outputFileTracingIncludes: {
    '/api/operations': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './node_modules/pdfjs-dist/standard_fonts/**/*',
      './node_modules/pdfjs-dist/cmaps/**/*',
      './node_modules/pdfjs-dist/wasm/**/*',
      './node_modules/pdfjs-dist/iccs/**/*',
    ],
  },
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
