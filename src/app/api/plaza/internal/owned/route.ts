import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { currentAff, AFF } from '../../../../../../public/plaza/pets.js';

// 실시간 서버(워커) 전용: 이 회원이 가진 잠금 꾸미기와, 데리고 다닐 수 있는 반려동물(삐지지 않은 active)을 알려 준다.
// 워커 → 여기 호출은 비밀키(x-plaza-secret = PLAZA_ADMIN_SECRET)로만. 워커가 입장 인사(hello)의 모습에서 안 가진 것을 지운다.
export async function POST(req: Request) {
  const secret = process.env.PLAZA_ADMIN_SECRET;
  if (!secret || req.headers.get('x-plaza-secret') !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { uid } = await req.json().catch(() => ({}));
  if (!uid || typeof uid !== 'string') return NextResponse.json({ error: 'uid_required' }, { status: 400 });
  const [k, p] = await Promise.all([adminDb.doc(`plazaKeys/${uid}`).get(), adminDb.doc(`plazaPets/${uid}`).get()]);
  const unlocks: string[] = k.data()?.unlocks || [];
  const pd = p.data();
  const id = pd?.active as string | undefined;
  const pet = id && pd?.adopted?.[id] && currentAff(pd?.aff?.[id], pd?.affAt?.[id]) >= AFF.follow ? { id, name: String(pd.adopted[id]) } : null;
  return NextResponse.json({ unlocks, pet });
}
