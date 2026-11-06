import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { plazaKey } from '@/lib/plazaKey';
import { NPC_ID } from '@/lib/plazaNpc';

// 키링 월드 메뉴 > 대화: 내가 1:1로 대화한 상대 목록(최근 순)
// 상대 uid는 이미 그 대화에서 실시간 서버가 알려 준 값이라 새로 드러나는 정보가 아니다(대화 기록을 다시 열 때 필요).
export async function GET(req: Request) {
  try {
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
    const snap = await adminDb.collection('plazaChats').where('participants', 'array-contains', me).limit(100).get();
    const convs = snap.docs
      .filter((d) => !d.get('purgeAt'))
      .map((d) => {
        const x = d.data() as { participants?: string[]; nicks?: Record<string, string>; lastMessage?: string; lastFrom?: string; lastAt?: { toMillis?: () => number } };
        const other = (x.participants || []).find((p) => p !== me) || '';
        const npc = other === NPC_ID;
        return {
          uid: npc ? 'npc' : other, key: npc ? null : plazaKey(other), npc,
          nick: String(x.nicks?.[other] || (npc ? '키키' : '회원')).replace(/\s*\(AI\)$/, ''),
          last: String(x.lastMessage || '').slice(0, 60), mineLast: x.lastFrom === me, at: x.lastAt?.toMillis?.() || 0,
        };
      })
      .filter((c) => c.uid)
      .sort((a, b) => b.at - a.at)
      .slice(0, 50);
    return NextResponse.json({ convs });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
