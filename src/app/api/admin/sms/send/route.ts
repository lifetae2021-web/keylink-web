import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { sendSMS } from '@/lib/sms';

export async function POST(req: NextRequest) {
  try {
    const { targets, message, scheduledDate } = await req.json() as {
      targets: { phone: string; name: string; gender: string; slotNumber?: number; userId?: string }[];
      message: string;
      scheduledDate?: string;
    };

    if (!targets?.length || !message) {
      return NextResponse.json({ error: '수신자와 메시지가 필요합니다.' }, { status: 400 });
    }

    // 로컬 발송 차단 코드 제거됨 (실발송 모드 적용)

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.doc(`users/${decodedToken.uid}`).get();

    const callerRole = userSnap.data()?.role;
    if (!userSnap.exists || (callerRole !== 'admin' && callerRole !== 'super_admin')) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    let successCount = 0;
    let failCount = 0;
    let lastError = null;

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
        await sendSMS({ to: phone, text: personalized, scheduledDate });
        successCount++;
      } catch (e: any) {
        console.error(`SMS 발송 실패 (${phone}):`, e?.message || e);
        lastError = e?.message || String(e);
        failCount++;
      }
    }

    return NextResponse.json({ success: true, successCount, failCount, isMock: false, lastError });
  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return NextResponse.json({ error: '문자 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
