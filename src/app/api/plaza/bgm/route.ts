import { NextResponse } from 'next/server';
import { listBgm } from '@/lib/plazaBgm';

// 키링 월드가 지금 테마에서 틀 배경음악 목록(켜진 곡만, 순서대로)
export async function GET(req: Request) {
  const theme = new URL(req.url).searchParams.get('theme') || 'default';
  try {
    const tracks = (await listBgm()).filter((t) => t.enabled && t.url && (t.theme === 'all' || t.theme === theme)).map((t) => ({ id: t.id, title: t.title, url: t.url }));
    return NextResponse.json({ tracks }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}
