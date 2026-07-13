import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkOverlap } from '@/lib/admin/overlap';

/**
 * 관리자용 수동 기수 참여 등록 API
 * POST /api/admin/applications/create-manual
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId, status, bypassOverlapCheck, selectedOption, inheritedAmountPaid } = await req.json();

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

    // 2. 회원 정보, 기수 정보 및 기존 신청서 내역 병렬 조회
    const userDocRef = adminDb.doc(`users/${userId}`);
    const sessionDocRef = adminDb.doc(`sessions/${sessionId}`);
    const existingAppsQuery = adminDb.collection('applications')
      .where('userId', '==', userId)
      .where('sessionId', '==', sessionId);

    const [userSnap, sessionSnap, existingApps] = await Promise.all([
      userDocRef.get(),
      sessionDocRef.get(),
      existingAppsQuery.get()
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

    // 3. 이미 신청 내역이 존재하는지 확인 (중복 등록 방지 및 닼템 전환 허용)
    let existingAppDoc = null;
    if (!existingApps.empty) {
      existingAppDoc = existingApps.docs[0];
      const existingData = existingAppDoc.data();
      
      const isTargetSuperAdmin = userData.role === 'super_admin';
      // 이미 등록되어 있더라도 상태가 다른 경우 업데이트를 허용 (단, 이미 동일한 상태인 경우만 방지)
      if (!isTargetSuperAdmin && existingData.status !== 'cancelled' && existingData.status === status) {
        const statusLabel = status === 'confirmed' ? '참가 확정' : status === 'selected' ? '선발 대기' : '검토 중';
        return NextResponse.json({ error: `이미 해당 기수에 '${statusLabel}' 상태로 등록되어 있습니다.` }, { status: 400 });
      }
    }

    // 🌑 닼템: super_admin 계정은 시스템 전체에서 투명인간 처리
    const isDarkTemplar = userData.role === 'super_admin';

    // 중복 만남 체크 (닼템/더미가 아니며 'confirmed' 혹은 'selected'인 경우에만 검사)
    if (status === 'confirmed' || status === 'selected') {
      const isDummyForCheck = userId.startsWith('user_m_') || userId.startsWith('user_f_') || userData.isDummy === true;
      const isDarkTemplarForCheck = userData.role === 'super_admin' || isDarkTemplar;

      if (!isDummyForCheck && !isDarkTemplarForCheck && !bypassOverlapCheck) {
        const overlapMessage = await checkOverlap(userId, sessionId, gender);
        if (overlapMessage) {
          return NextResponse.json({ overlapWarning: true, message: overlapMessage }, { status: 200 });
        }
      }
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

    // 새 신청서 문서 ID 자동 생성 또는 기존 문서 재사용
    const isNew = !existingAppDoc;
    const newAppRef = isNew 
      ? adminDb.collection('applications').doc() 
      : adminDb.collection('applications').doc(existingAppDoc!.id);
    const isDummy = userId.startsWith('user_m_') || userId.startsWith('user_f_') || userData.isDummy === true;

    // 4. 트랜잭션을 통한 기수 인원 카운터 업데이트 및 슬롯 배정
    await adminDb.runTransaction(async (transaction) => {
      // 트랜잭션 내에서 최신 세션 문서 조회
      const freshSessionSnap = await transaction.get(sessionDocRef);
      if (!freshSessionSnap.exists) throw new Error('기수 정보가 존재하지 않습니다.');
      const freshSessionData = freshSessionSnap.data()!;

      let prevStatus = 'none';
      let prevSlot = null;
      let originalCreatedAt = null;
      let originalAppliedAt = null;
      let wasPrevDarkTemplar = false;

      if (!isNew) {
        const freshAppSnap = await transaction.get(newAppRef);
        if (freshAppSnap.exists) {
          const freshAppData = freshAppSnap.data()!;
          prevStatus = freshAppData.status;
          prevSlot = freshAppData.slotNumber;
          originalCreatedAt = freshAppData.createdAt;
          originalAppliedAt = freshAppData.appliedAt;
          wasPrevDarkTemplar = freshAppData.isDarkTemplar === true;
        }
      }

      let assignedSlot: number | null = null;
      
      if (status === 'confirmed') {
        // 🌑 닼템는 슬롯 배정 & 정원 카운트 완전 제외
        if (isDummy || isDarkTemplar) {
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
                const dIsDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDarkTemplar === true;
                return !dIsDummy;
              })
              .map(d => d.data().slotNumber)
              .filter((n): n is number => n != null)
          );

          let slot = 1;
          while (slot <= maxCount && usedSlots.has(slot)) slot++;

          assignedSlot = slot;
        }
      }

      const newAppData: any = {
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
        createdAt: originalCreatedAt || FieldValue.serverTimestamp(),
        appliedAt: originalAppliedAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // v12.5.0: 옵션 및 금액 승계 적용
      if (selectedOption) {
        if (gender === 'male') {
          newAppData.maleOption = selectedOption;
        } else {
          newAppData.femaleOption = selectedOption;
        }
      }
      if (inheritedAmountPaid !== undefined && inheritedAmountPaid !== null) {
        newAppData.amountPaid = Number(inheritedAmountPaid);
        newAppData.price = Number(inheritedAmountPaid);
      }

      // 🌑 닼템 플래그 부여
      if (isDarkTemplar) {
        newAppData.isDarkTemplar = true;
      }

      // 신청서 등록/업데이트
      transaction.set(newAppRef, newAppData);

      // 세션 정원 카운터 처리 (닼템 및 더미 제외)
      const wasConfirmedNormal = prevStatus === 'confirmed' && !wasPrevDarkTemplar && !isDummy;
      const willBeConfirmedNormal = status === 'confirmed' && !isDarkTemplar && !isDummy;
      
      const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';

      if (wasConfirmedNormal && !willBeConfirmedNormal) {
        // 일반 확정 상태에서 다른 상태로 변경 또는 닼템로 전환 시 ➔ 정원 -1
        transaction.update(sessionDocRef, {
          [counterField]: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (!wasConfirmedNormal && willBeConfirmedNormal) {
        // 새로 일반 확정 상태로 추가/변경 시 ➔ 정원 +1
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
