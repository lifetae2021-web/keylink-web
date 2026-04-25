import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Admin check
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { sessionId, count } = body;

    if (!sessionId || !count) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 기존 확정자들의 호수(slotNumber) 조회하여 중복 방지
    const existingApps = await adminDb.collection('applications')
      .where('sessionId', '==', sessionId)
      .where('status', '==', 'confirmed')
      .get();

    const usedMaleSlots = new Set<number>();
    const usedFemaleSlots = new Set<number>();

    existingApps.docs.forEach(doc => {
      const data = doc.data();
      if (data.slotNumber) {
        if (data.gender === 'male') usedMaleSlots.add(data.slotNumber);
        if (data.gender === 'female') usedFemaleSlots.add(data.slotNumber);
      }
    });

    let nextMaleSlot = 1;
    let nextFemaleSlot = 1;

    const batch = adminDb.batch();
    const jobs = ['대기업 사원', 'IT 개발자', '공공기관 대리', '전문직', '스타트업 기획자', '연구원', '금융권 주임', '의료계 종사자'];
    const locations = ['부산 진구', '부산 해운대구', '창원 성산구', '창원 의창구', '부산 수영구'];

    for (let i = 1; i <= count; i++) {
      const now = FieldValue.serverTimestamp();
      
      // 남성 빈 호수 찾기
      while (usedMaleSlots.has(nextMaleSlot)) nextMaleSlot++;
      usedMaleSlots.add(nextMaleSlot);
      
      // 남성 더미
      const mId = `dummy_male_${i}_${Date.now()}`;
      const mUserId = `user_m_${i}_${Date.now()}`;
      batch.set(adminDb.collection('applications').doc(mId), {
        userId: mUserId,
        sessionId,
        name: `더미남${i}`,
        age: 28 + Math.floor(Math.random() * 7),
        gender: 'male',
        job: jobs[Math.floor(Math.random() * jobs.length)],
        residence: locations[Math.floor(Math.random() * locations.length)],
        phone: `010-1234-567${i}`,
        status: 'confirmed',
        paymentConfirmed: true,
        slotNumber: nextMaleSlot,
        appliedAt: now,
        updatedAt: now
      });
      batch.set(adminDb.collection('users').doc(mUserId), {
        name: `더미남${i}`,
        gender: 'male',
        job: jobs[Math.floor(Math.random() * jobs.length)],
        residence: locations[Math.floor(Math.random() * locations.length)],
        isJobReviewed: true,
        photos: [`https://picsum.photos/seed/m${mId}/200/200`]
      }, { merge: true });

      // 여성 빈 호수 찾기
      while (usedFemaleSlots.has(nextFemaleSlot)) nextFemaleSlot++;
      usedFemaleSlots.add(nextFemaleSlot);

      // 여성 더미
      const fId = `dummy_female_${i}_${Date.now()}`;
      const fUserId = `user_f_${i}_${Date.now()}`;
      batch.set(adminDb.collection('applications').doc(fId), {
        userId: fUserId,
        sessionId,
        name: `더미녀${i}`,
        age: 26 + Math.floor(Math.random() * 7),
        gender: 'female',
        job: jobs[Math.floor(Math.random() * jobs.length)],
        residence: locations[Math.floor(Math.random() * locations.length)],
        phone: `010-9876-543${i}`,
        status: 'confirmed',
        paymentConfirmed: true,
        slotNumber: nextFemaleSlot,
        appliedAt: now,
        updatedAt: now
      });
      batch.set(adminDb.collection('users').doc(fUserId), {
        name: `더미녀${i}`,
        gender: 'female',
        job: jobs[Math.floor(Math.random() * jobs.length)],
        residence: locations[Math.floor(Math.random() * locations.length)],
        isJobReviewed: true,
        photos: [`https://picsum.photos/seed/f${fId}/200/200`]
      }, { merge: true });
    }

    batch.update(adminDb.collection('sessions').doc(sessionId), {
      currentMale: FieldValue.increment(count),
      currentFemale: FieldValue.increment(count),
    });

    await batch.commit();

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Seed dummy API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
