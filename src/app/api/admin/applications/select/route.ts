import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { sendSMS } from '@/lib/sms';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 선발 처리 및 알림톡 발송 API
 * v7.6.0
 */

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json();

    if (!applicationId) {
      return NextResponse.json({ error: '신청서 ID가 필요합니다.' }, { status: 400 });
    }

    // 1. 관리자 권한 확인 (Authorization 헤더 검증)
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

    // 2. 신청서 및 사용자/세션 정보 조회
    const appDoc = await adminDb.doc(`applications/${applicationId}`).get();
    if (!appDoc.exists) {
      return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const appData = appDoc.data()!;
    const userId = appData.userId;
    const sessionId = appData.sessionId;

    // 이미 선발된 경우 중복 발송 방지
    if (appData.status === 'selected') {
      return NextResponse.json({ success: true, message: '이미 선발된 신청자입니다.' });
    }

    const [userDoc, sessionDoc] = await Promise.all([
      adminDb.doc(`users/${userId}`).get(),
      adminDb.doc(`sessions/${sessionId}`).get(),
    ]);

    const userData = userDoc.data();
    const sessionData = sessionDoc.data();

    if (!userData || !sessionData) {
      return NextResponse.json({ error: '사용자 또는 세션 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. Firestore 상태 업데이트 (selected)
    await adminDb.doc(`applications/${applicationId}`).update({
      status: 'selected',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 4. 알림 문자 발송
    const name = userData.name || '참가자';
    const regionLabel = sessionData.region === 'busan' ? '부산' : sessionData.region === 'changwon' ? '창원' : '부산';
    const sessionTitle = `${regionLabel} ${sessionData.episodeNumber}기`;
    const phone = userData.phone || appData.phone;

    if (!phone) {
      return NextResponse.json({ 
        success: true, 
        warning: '상태는 변경되었으나 연락처가 없어 문자를 발송하지 못했습니다.' 
      });
    }

    const message = `[키링크] 선발 축하 안내

안녕하세요, ${name}님!
${sessionTitle} 참가자로 선발되신 것을 진심으로 축하드립니다. 🎉

성비와 조건을 고려하여 선정되셨습니다. 아래 계좌로 참가비 입금 부탁드립니다.

■ 참가비: 35,000원
■ 계좌: 카카오뱅크 3333-01-8290604 (박종현)
■ 기한: 안내 후 12시간 이내

입금 확인 후 확정 처리가 완료됩니다.
감사합니다.`;

    let smsResult;
    try {
      smsResult = await sendSMS({ to: phone, text: message });
    } catch (smsError: any) {
      console.error('SMS Send Error:', smsError);
      return NextResponse.json({ 
        success: true, 
        warning: `상태는 변경되었으나 문자 발송에 실패했습니다: ${smsError.message}` 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: '선발 처리 및 안내 문자 발송이 완료되었습니다.',
      smsResult 
    });

  } catch (error: any) {
    console.error('Selection API Error:', error);
    return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
