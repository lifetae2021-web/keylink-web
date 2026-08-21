import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { format } from 'date-fns';

export async function POST(request: Request) {
  try {
    const { isUnique, path, visitorId, userId, referrer, userAgent } = await request.json();
    const today = format(new Date(), 'yyyy-MM-dd');
    const docRef = adminDb.collection('analytics').doc(today);

    const updateData: any = {
      pv: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    };

    if (isUnique) {
      updateData.uv = FieldValue.increment(1);
    }

    // 서로 의존성이 없는 작업들을 병렬로 실행 (순차 await로 인한 지연 방지)
    const tasks: Promise<unknown>[] = [
      // 1. 일별 통계 업데이트
      docRef.set(updateData, { merge: true }),
    ];

    // 2. 상세 방문 로그 기록
    if (path && visitorId) {
      tasks.push(adminDb.collection('visitor_logs').add({
        path,
        visitorId,
        userId: userId || null,
        referrer: referrer || '',
        userAgent: userAgent || '',
        timestamp: FieldValue.serverTimestamp(),
      }));
    }

    // 3. (CRM) 유저별 방문 횟수 업데이트 (1시간에 1번 제한)
    if (userId) {
      const userRef = adminDb.collection('users').doc(userId);
      tasks.push(userRef.get().then(userSnap => {
        if (!userSnap.exists) return;

        const userData = userSnap.data() || {};
        const now = new Date();
        const lastVisit = userData?.lastVisitAt?.toDate?.() || new Date(0);

        const updatePayload: any = {};

        if (visitorId && (!userData.knownVisitorIds || !userData.knownVisitorIds.includes(visitorId))) {
          updatePayload.knownVisitorIds = FieldValue.arrayUnion(visitorId);
        }

        // 마지막 방문으로부터 1시간(3600000ms)이 지났을 때만 카운트 증가
        if (now.getTime() - lastVisit.getTime() > 60 * 60 * 1000) {
          updatePayload.visitCount = FieldValue.increment(1);
          updatePayload.lastVisitAt = FieldValue.serverTimestamp();
        }

        if (Object.keys(updatePayload).length > 0) {
          return userRef.update(updatePayload);
        }
      }));
    } else if (visitorId) {
      // 4. (CRM) 로그아웃 유저 방문 추적 (알려진 기기 식별자 기반)
      tasks.push(adminDb.collection('users').where('knownVisitorIds', 'array-contains', visitorId).limit(2).get().then(querySnap => {
        // 기기를 여러 명이 공유하는 경우(검색 결과 2명 이상)를 방지하기 위해 정확히 1명일 때만 처리
        if (querySnap.size !== 1) return;

        const userDoc = querySnap.docs[0];
        const userData = userDoc.data() || {};
        const now = new Date();
        const lastVisit = userData?.lastVisitAt?.toDate?.() || new Date(0);

        if (now.getTime() - lastVisit.getTime() > 60 * 60 * 1000) {
          return userDoc.ref.update({
            visitCount: FieldValue.increment(1),
            lastVisitAt: FieldValue.serverTimestamp()
          });
        }
      }));
    }

    await Promise.all(tasks);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Analytics API] Error tracking visit:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
