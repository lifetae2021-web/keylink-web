import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { phone, excludeUid } = await req.json();
    if (!phone) return NextResponse.json({ error: '연락처를 입력해 주세요.' }, { status: 400 });

    const snap = await adminDb.collection('users').where('phone', '==', phone).limit(1).get();

    if (!snap.empty) {
      const found = snap.docs[0];
      // 본인 계정은 제외 (소셜 가입 시 이미 일부 저장된 경우 대비)
      if (excludeUid && found.id === excludeUid) {
        return NextResponse.json({ available: true });
      }
      return NextResponse.json({ available: false, message: '이미 가입된 연락처입니다.' });
    }

    return NextResponse.json({ available: true });
  } catch (error: any) {
    console.error('[Check Phone]', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
