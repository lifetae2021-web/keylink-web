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
  // 보안 헤더: 클릭재킹(다른 사이트에 몰래 띄우기)·파일 종류 위장·주소 정보 유출·기기 권한 오용 방지
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
  // 광장(정적 3D 공간): /plaza, /plaza/ 깔끔한 주소를 정적 파일로 연결
  async rewrites() {
    return [
      { source: '/plaza', destination: '/plaza/index.html' },
      { source: '/plaza/', destination: '/plaza/index.html' },
    ];
  },
};

export default nextConfig;
