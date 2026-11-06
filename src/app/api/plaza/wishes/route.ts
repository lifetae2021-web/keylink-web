import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// 소원 트리에 걸린 소원(크리스마스 테마) — 누구나 볼 수 있다(닉네임과 함께 공개되는 소원이라 회원 식별값은 빼고 보냄)
// 관리자가 내린 것(hidden)은 빼고 최근 것부터 TREE_MAX개
const TREE_MAX = 90;

export async function GET(req: Request) {
  const theme = new URL(req.url).searchParams.get('theme') || 'xmas';
  try {
    const snap = await adminDb.collection('plazaWishes').orderBy('createdAt', 'desc').limit(400).get();
    const wishes = snap.docs
      .filter((d) => d.get('theme') === theme && !d.get('hidden') && !d.get('purgeAt'))
      .slice(0, TREE_MAX)
      .map((d) => ({ id: d.id, nick: String(d.get('nick') || ''), text: String(d.get('text') || ''), orn: String(d.get('orn') || 'star') }));
    return NextResponse.json({ wishes }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ wishes: [] });
  }
}
