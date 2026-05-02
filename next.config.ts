import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
              "img-src 'self' data: https://i.ytimg.com https://img.youtube.com",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://www.googleapis.com https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
