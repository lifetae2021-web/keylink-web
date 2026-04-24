import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { sendSMS } from '@/lib/sms';

export async function POST(req: NextRequest) {
  try {
    const { targets, message } = await req.json() as {
      targets: { phone: string; name: string; gender: string; slotNumber?: number; userId?: string }[];
      message: string;
    };

    if (!targets?.length || !message) {
      return NextResponse.json({ error: '수신자와 메시지가 필요합니다.' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.doc(`users/${decodedToken.uid}`).get();

    if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    let successCount = 0;
    let failCount = 0;

    for (const target of targets) {
      // app.phone이 비어있으면 users 컬렉션에서 조회 (기존 select 라우트와 동일 패턴)
      let phone = target.phone;
      let name = target.name;
      if (!phone && target.userId) {
        const userDoc = await adminDb.doc(`users/${target.userId}`).get();
        phone = userDoc.data()?.phone || '';
        name = userDoc.data()?.name || name;
      }

      if (!phone) { failCount++; continue; }

      const genderLabel = target.gender === 'male' ? '남' : '녀';
      const slotLabel = target.slotNumber != null ? String(target.slotNumber) : '?';
      const personalized = message
        .replace(/\{이름\}/g, name)
        .replace(/\{성별\}/g, genderLabel)
        .replace(/\{호수\}/g, slotLabel);
      try {
        await sendSMS({ to: phone, text: personalized });
        successCount++;
      } catch {
        failCount++;
      }
    }

    return NextResponse.json({ success: true, successCount, failCount });
  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return NextResponse.json({ error: '문자 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
