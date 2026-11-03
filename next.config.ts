import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Ensure we don't accidentally bundle server-only code
  serverExternalPackages: ['firebase-admin'],
  // 광장(정적 3D 공간): /plaza, /plaza/ 깔끔한 주소를 정적 파일로 연결
  async rewrites() {
    return [
      { source: '/plaza', destination: '/plaza/index.html' },
      { source: '/plaza/', destination: '/plaza/index.html' },
    ];
  },
};

export default nextConfig;
