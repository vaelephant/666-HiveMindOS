import path from 'path';
import type { NextConfig } from 'next';

/**
 * Parent dirs may contain another package-lock.json; without this, Next infers the wrong
 * workspace root and server bundles can fail to resolve webpack chunks (e.g. `./331.js`).
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Next.js 16 代理默认会截断较大的 multipart 请求体（PDF 等文档常 > 1MB）
  experimental: {
    proxyClientMaxBodySize: '220mb',
    serverActions: {
      bodySizeLimit: '220mb',
    },
  },
  async redirects() {
    return [
      { source: '/chat', destination: '/hivemind-chat', permanent: false },
      { source: '/chat/:path*', destination: '/hivemind-chat/:path*', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/aida-public/**',
      },
    ],
  },
};

export default nextConfig;
