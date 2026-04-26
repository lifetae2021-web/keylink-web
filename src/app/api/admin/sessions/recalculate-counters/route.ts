import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

/**
 * 세션별 currentMale/currentFemale 카운터를 confirmed 신청서 기준으로 재계산
 */
export async function POST(req: NextRequest) {
  try {
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

    const sessionsSnap = await adminDb.collection('sessions').get();
    const results: { sessionId: string; before: any; after: any }[] = [];

    for (const sessionDoc of sessionsSnap.docs) {
      const sessionId = sessionDoc.id;
      const sessionData = sessionDoc.data();

      const confirmedSnap = await adminDb.collection('applications')
        .where('sessionId', '==', sessionId)
        .where('status', '==', 'confirmed')
        .get();

      let confirmedMale = 0;
      let confirmedFemale = 0;
      confirmedSnap.docs.forEach(d => {
        if (d.data().gender === 'male') confirmedMale++;
        else confirmedFemale++;
      });

      results.push({
        sessionId,
        before: { currentMale: sessionData.currentMale, currentFemale: sessionData.currentFemale },
        after: { currentMale: confirmedMale, currentFemale: confirmedFemale },
      });

      await adminDb.doc(`sessions/${sessionId}`).update({
        currentMale: confirmedMale,
        currentFemale: confirmedFemale,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
