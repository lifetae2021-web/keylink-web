import type { MetadataRoute } from 'next';

// 홈 화면에 추가 시 아이콘/이름 (start_url 미지정 → 추가한 페이지 그대로 열림)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '키링크',
    short_name: '키링크',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
