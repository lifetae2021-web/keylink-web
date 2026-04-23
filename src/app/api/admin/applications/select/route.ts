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
    const { applicationId, customMessage } = await req.json();

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
    const phone = userData.phone || appData.phone;

    if (!phone) {
      return NextResponse.json({ 
        success: true, 
        warning: '상태는 변경되었으나 연락처가 없어 문자를 발송하지 못했습니다.' 
      });
    }

    // 날짜 포맷팅 로직 (한국 시간 KST 기준)
    const eventTime = sessionData.eventDate.toDate();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(eventTime);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const formattedDate = `${getPart('month')}/${getPart('day')}`;
    const formattedDay = `(${getPart('weekday')})`;
    const formattedTime = `${getPart('hour')}:${getPart('minute')}`;

    const message = customMessage || `안녕하세요 ! 키링크에 지원해주셔서 감사합니다☺️
${name}님은 ${formattedDate} ${formattedDay} ${formattedTime} 소개팅 날짜가 지정되었습니다

아래 계좌번호로 ${ (appData.price || sessionData.price || 60000).toLocaleString('ko-KR') }원 입금해주셔야 라인업에 확정등록되니 참고 부탁드립니다 :)
3333359229548 카카오뱅크 태영훈(키링크) 입금 또는 참석가능 여부 알려주세요😭
혹시나 입금이 늦을 것 같은 경우 말씀해주세요.

좋은 인연 만날 수 있도록 키링크가 끝까지 책임질게요🥰`;

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
