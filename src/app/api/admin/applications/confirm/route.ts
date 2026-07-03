import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { sendSMS } from '@/lib/sms';
import { FieldValue } from 'firebase-admin/firestore';
import { checkOverlap } from '@/lib/admin/overlap';

/**
 * 입금확정(confirmed) 처리 및 안내 문자 발송 API
 * v9.2.0: 트랜잭션 기반 슬롯 관리(Hard Limit) + 문자 발송 통합
 */

export async function POST(req: NextRequest) {
  try {
    const { applicationId, customMessage, price, bypassOverlapCheck } = await req.json();

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
    
    const callerRole = userSnap.data()?.role;
    if (!userSnap.exists || (callerRole !== 'admin' && callerRole !== 'super_admin')) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    // 2. 신청서 정보 사전 조회
    const initialAppSnap = await adminDb.doc(`applications/${applicationId}`).get();
    if (!initialAppSnap.exists) {
      return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const initialAppData = initialAppSnap.data()!;
    const sessionId = initialAppData.sessionId;
    const userId = initialAppData.userId;
    const gender = initialAppData.gender;

    // 🌑 다크템플러 및 더미 확인용 유저 정보 조회
    const userDocForCheck = await adminDb.doc(`users/${userId}`).get();
    const isDummyForCheck = applicationId.startsWith('dummy') || userId.startsWith('user_m_') || userId.startsWith('user_f_') || userDocForCheck.data()?.isDummy === true;
    const isDarkTemplarForCheck = userDocForCheck.data()?.role === 'super_admin' || initialAppData.isDarkTemplar === true;

    const isDev = process.env.NODE_ENV === 'development';
    // 중복 만남 체크 (다크템플러/더미가 아니며 bypass하지 않는 경우)
    if (!isDev && !isDummyForCheck && !isDarkTemplarForCheck && !bypassOverlapCheck) {
      const overlapMessage = await checkOverlap(userId, sessionId, gender);
      if (overlapMessage) {
        return NextResponse.json({ overlapWarning: true, message: overlapMessage }, { status: 200 });
      }
    }

    let isWaitlisted = false;

    // 3. 트랜잭션을 통한 인원 체크 및 상태 업데이트
    try {
      await adminDb.runTransaction(async (transaction) => {
        const appRef = adminDb.doc(`applications/${applicationId}`);
        const sessionRef = adminDb.doc(`sessions/${sessionId}`);
        
        const [appSnap, sessionSnap] = await Promise.all([
          transaction.get(appRef),
          transaction.get(sessionRef)
        ]);

        if (!appSnap.exists || !sessionSnap.exists) {
          throw new Error('데이터를 찾을 수 없습니다.');
        }

        const appData = appSnap.data()!;
        const sessionData = sessionSnap.data()!;
        const prevStatus = appData.status;

        // 이미 입금확정(confirmed)된 경우 중복 처리 방지
        if (prevStatus === 'confirmed') {
          return;
        }

        let assignedSlot: number | null = null;
        const maxCount = gender === 'male' ? (sessionData.maxMale || 8) : (sessionData.maxFemale || 8);

        const userSnapForApp = await transaction.get(adminDb.doc(`users/${appData.userId}`));
        const isDummy = appData.id?.startsWith('dummy') || appData.userId?.startsWith('user_m_') || appData.userId?.startsWith('user_f_') || userSnapForApp.data()?.isDummy === true;
        // 🌑 다크템플러: super_admin은 슬롯 배정 & 정원 카운트 제외
        const isDarkTemplar = userSnapForApp.data()?.role === 'super_admin' || appData.isDarkTemplar === true;

        if (isDummy || isDarkTemplar) {
          assignedSlot = null;
        } else {
          // 트랜잭션 내부에서 실시간 confirmed 리스트 조회
          const confirmedQuery = adminDb.collection('applications')
            .where('sessionId', '==', sessionId)
            .where('gender', '==', gender)
            .where('status', '==', 'confirmed');
          const confirmedSnap = await transaction.get(confirmedQuery);

          const usedSlots = new Set(confirmedSnap.docs
            .filter(d => {
              const data = d.data();
              const dIsDummy = data.id?.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_');
              return !dIsDummy && data.isDarkTemplar !== true;
            })
            .map(d => d.data().slotNumber)
            .filter((n): n is number => n != null));

          // 1~maxCount 범위에서 빈 슬롯 탐색
          let slot = 1;
          while (slot <= maxCount && usedSlots.has(slot)) slot++;

          if (slot > maxCount) {
            isWaitlisted = true;
          } else {
            assignedSlot = slot;
          }
        }

        const targetStatus = isWaitlisted ? 'waitlisted' : 'confirmed';
        const isIncreasing = (targetStatus === 'confirmed' && prevStatus !== 'confirmed');

        const updateData: any = {
          status: targetStatus,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (price !== undefined) {
          updateData.price = price;
        }

        if (targetStatus === 'confirmed') {
          updateData.paymentConfirmed = true;
          updateData.slotNumber = assignedSlot;
        }

        transaction.update(appRef, updateData);

        const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';
        if (isIncreasing && !isDarkTemplar) {
          transaction.update(sessionRef, {
            [counterField]: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
    } catch (txnError: any) {
      console.error('Confirm Transaction Failed:', txnError);
      return NextResponse.json({ error: txnError.message || '인원 체크 및 상태 변경 중 오류가 발생했습니다.' }, { status: 400 });
    }

    // 4. 사용자 정보 조회 및 알림 문자 발송
    const [userDoc, sessionDoc] = await Promise.all([
      adminDb.doc(`users/${userId}`).get(),
      adminDb.doc(`sessions/${sessionId}`).get(),
    ]);

    const userData = userDoc.data();
    const sessionData = sessionDoc.data();

    if (!userData || !sessionData) {
      return NextResponse.json({ 
        success: true, 
        warning: '상태는 변경되었으나 사용자/세션 정보를 찾지 못해 문자를 발송하지 못했습니다.' 
      });
    }

    const name = userData.name || initialAppData.name || '참가자';
    const phone = userData.phone || initialAppData.phone;

    if (!phone) {
      return NextResponse.json({ 
        success: true, 
        warning: '상태는 변경되었으나 연락처가 없어 문자를 발송하지 못했습니다.' 
      });
    }

    // 대기 번호 등록된 경우에는 확정 안내 문자가 아닌 별도 알림을 띄우거나 함
    if (isWaitlisted) {
      return NextResponse.json({
        success: true,
        warning: '정원이 초과되어 문자 발송 없이 [정원초과대기] 상태로 등록되었습니다.'
      });
    }

    // 날짜 포맷팅 로직
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

    const sessionName = sessionData.episodeNumber
      ? `${sessionData.region === 'busan' ? '부산' : '창원'} ${sessionData.episodeNumber}기`
      : '';

    const message = customMessage || `안녕하세요 ${name}님! 키링크입니다.
입금이 확인되어 ${sessionName} 참가가 최종 확정되었습니다.

일시: ${formattedDate} ${formattedDay} ${formattedTime}
장소: ${sessionData.venue || sessionData.location || ''}

당일 현장에서 뵙겠습니다! 좋은 인연 만나시길 바랍니다 :)`;

    let smsResult;
    try {
      smsResult = await sendSMS({ to: phone, text: message });
      if (smsResult?.success) {
        await adminDb.doc(`applications/${applicationId}`).update({
          isSmsSent: true,
          lastSmsSentAt: FieldValue.serverTimestamp()
        });
      }
    } catch (smsError: any) {
      console.error('SMS Send Error:', smsError);
      return NextResponse.json({ 
        success: true, 
        warning: `상태는 변경되었으나 문자 발송에 실패했습니다: ${smsError.message}` 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: '입금확정 및 참가확정 안내 문자 발송이 완료되었습니다.',
      smsResult,
      isMock: smsResult?.mock || false
    });

  } catch (error: any) {
    console.error('Confirm API Error:', error);
    return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
