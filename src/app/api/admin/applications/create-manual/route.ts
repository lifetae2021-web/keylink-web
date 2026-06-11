import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 관리자용 수동 기수 참여 등록 API
 * POST /api/admin/applications/create-manual
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId, status } = await req.json();

    if (!userId || !sessionId || !status) {
      return NextResponse.json({ error: '회원 ID, 기수 ID, 등록할 상태가 필요합니다.' }, { status: 400 });
    }

    if (!['applied', 'selected', 'confirmed'].includes(status)) {
      return NextResponse.json({ error: '올바르지 않은 상태 값입니다.' }, { status: 400 });
    }

    // 1. 관리자 권한 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.doc(`users/${decodedToken.uid}`).get();
    
    const callerRole = callerSnap.data()?.role;
    if (!callerSnap.exists || (callerRole !== 'admin' && callerRole !== 'super_admin')) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    // 2. 이미 신청 내역이 존재하는지 확인 (중복 등록 방지)
    const existingApps = await adminDb.collection('applications')
      .where('userId', '==', userId)
      .where('sessionId', '==', sessionId)
      .get();

    if (!existingApps.empty) {
      return NextResponse.json({ error: '이미 해당 기수에 신청 내역이 있는 회원입니다.' }, { status: 400 });
    }

    // 3. 회원 정보 및 기수 정보 조회
    const userDocRef = adminDb.doc(`users/${userId}`);
    const sessionDocRef = adminDb.doc(`sessions/${sessionId}`);

    const [userSnap, sessionSnap] = await Promise.all([
      userDocRef.get(),
      sessionDocRef.get()
    ]);

    if (!userSnap.exists) {
      return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!sessionSnap.exists) {
      return NextResponse.json({ error: '기수 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const userData = userSnap.data()!;
    const sessionData = sessionSnap.data()!;

    const gender = userData.gender;
    if (!gender || (gender !== 'male' && gender !== 'female')) {
      return NextResponse.json({ error: '회원의 성별 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    // 나이 계산
    let age = userData.age;
    if (!age && userData.birthDate) {
      const birthYearStr = userData.birthDate.includes('-') 
        ? userData.birthDate.split('-')[0] 
        : userData.birthDate.slice(0, 4);
      const birthYear = parseInt(birthYearStr, 10);
      if (!isNaN(birthYear)) {
        age = new Date().getFullYear() - birthYear + 1;
      }
    }

    // 새 신청서 문서 ID 자동 생성
    const newAppRef = adminDb.collection('applications').doc();
    const isDummy = userId.startsWith('user_m_') || userId.startsWith('user_f_') || userData.isDummy === true;

    // 4. 트랜잭션을 통한 기수 인원 카운터 업데이트 및 슬롯 배정
    await adminDb.runTransaction(async (transaction) => {
      // 트랜잭션 내에서 최신 세션 문서 조회
      const freshSessionSnap = await transaction.get(sessionDocRef);
      if (!freshSessionSnap.exists) throw new Error('기수 정보가 존재하지 않습니다.');
      const freshSessionData = freshSessionSnap.data()!;

      let assignedSlot: number | null = null;
      
      if (status === 'confirmed') {
        if (isDummy) {
          assignedSlot = null;
        } else {
          const maxCount = gender === 'male' ? (freshSessionData.maxMale || 8) : (freshSessionData.maxFemale || 8);

          // 현재 확정된 리스트 조회하여 사용 중인 슬롯 조회
          const confirmedQuery = adminDb.collection('applications')
            .where('sessionId', '==', sessionId)
            .where('gender', '==', gender)
            .where('status', '==', 'confirmed');
          const confirmedSnap = await transaction.get(confirmedQuery);

          const usedSlots = new Set<number>(
            confirmedSnap.docs
              .filter(d => {
                const data = d.data();
                const dIsDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_');
                return !dIsDummy;
              })
              .map(d => d.data().slotNumber)
              .filter((n): n is number => n != null)
          );

          let slot = 1;
          while (slot <= maxCount && usedSlots.has(slot)) slot++;

          // 정원 초과 시에도 수동 참여 등록은 허용하되, 슬롯 번호는 부여하지 않거나 대기 상태로 처리하지 않고 그대로 기입 가능하게 maxCount를 넘어가더라도 슬롯 부여
          assignedSlot = slot;
        }
      }

      const newAppData = {
        userId,
        sessionId,
        name: userData.name || '참가자',
        age: age || null,
        birthDate: userData.birthDate || '',
        gender,
        job: userData.admin_job || userData.job || userData.occupation || '',
        residence: userData.residence || '',
        height: userData.height || null,
        phone: userData.phone || '',
        status,
        paymentConfirmed: status === 'confirmed',
        slotNumber: assignedSlot,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // 신청서 등록
      transaction.set(newAppRef, newAppData);

      // 확정 상태일 경우 세션 카운터 +1
      if (status === 'confirmed') {
        const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';
        transaction.update(sessionDocRef, {
          [counterField]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: '참여 등록이 성공적으로 완료되었습니다.',
      applicationId: newAppRef.id
    });

  } catch (error: any) {
    console.error('Manual Session Registration Error:', error);
    return NextResponse.json({ error: error.message || '참여 등록 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
