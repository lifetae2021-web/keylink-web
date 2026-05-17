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
    const callerRole = userDoc.data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'super_admin') {
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
    const { MALE_JOBS, FEMALE_JOBS, LAST_NAMES, MALE_NAMES, FEMALE_NAMES, DUMMY_LOCATIONS } = await import('@/lib/constants/dummyData');

    // 세션 정보 조회하여 연령대 파악
    const sessionSnap = await adminDb.doc(`sessions/${sessionId}`).get();
    const sessionData = sessionSnap.data() || {};
    
    // 남성 타겟 연령대 파싱 — "90~96년생", "94~00년생" 형식 모두 지원
    let maleStart = 90;
    let maleEnd = 96;
    if (sessionData.targetMaleAge) {
      const cleaned = String(sessionData.targetMaleAge).replace(/년생/g, '').trim();
      const parts = cleaned.split('~');
      if (parts.length === 2) {
        const s = parseInt(parts[0].trim(), 10);
        const e = parseInt(parts[1].trim(), 10);
        if (!isNaN(s) && !isNaN(e) && s >= 0 && s <= 99 && e >= 0 && e <= 99) {
          maleStart = s;
          maleEnd = e;
          // ±00년생체럼 endYear이 startYear보다 작은 경우: 2000년대 초반으로 보정
          // 예) maleStart=94, maleEnd=0 → maleEnd=100 (2000년)
          if (maleEnd < maleStart) maleEnd += 100;
        }
      }
    }

    const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const generateName = (gender: 'male' | 'female') => {
      const last = getRandom(LAST_NAMES);
      const first = gender === 'male' ? getRandom(MALE_NAMES) : getRandom(FEMALE_NAMES);
      return last + first;
    };

    const generateMaleBirthDate = (): { birthDate: string; shortYear: number } => {
      const year = maleStart + Math.floor(Math.random() * (maleEnd - maleStart + 1));
      const fullYear = year > 50 ? 1900 + year : 2000 + year;
      const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
      const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
      return { birthDate: `${fullYear}-${month}-${day}`, shortYear: year };
    };

    // 여성: 해당 남성보다 1~3살 어리게 (연도 기준 +1~+3)
    const generateFemaleBirthDate = (maleShortYear: number): string => {
      const offset = 1 + Math.floor(Math.random() * 3); // 1, 2, 3 중 랜덤
      const year = maleShortYear + offset;
      const fullYear = year > 50 ? 1900 + year : 2000 + year;
      const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
      const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
      return `${fullYear}-${month}-${day}`;
    };

    const ts = Date.now();

    // ── 남성 루프 (count명) ──────────────────────
    for (let i = 1; i <= count; i++) {
      const now = FieldValue.serverTimestamp();
      const mId = `dummy_male_${i}_${ts + i}`;
      const mUserId = `user_m_${i}_${ts + i}`;
      const mName = generateName('male');
      const { birthDate: mBirth, shortYear: mShortYear } = generateMaleBirthDate();
      const mAge = new Date().getFullYear() - (mShortYear > 50 ? 1900 + mShortYear : 2000 + mShortYear) + 1;

      batch.set(adminDb.collection('applications').doc(mId), {
        userId: mUserId,
        sessionId,
        name: mName,
        age: mAge,
        birthDate: mBirth,
        gender: 'male',
        job: getRandom(MALE_JOBS),
        residence: getRandom(DUMMY_LOCATIONS),
        height: 170 + Math.floor(Math.random() * 16), // 170~185cm
        phone: `010-${1000 + Math.floor(Math.random() * 8999)}-${1000 + Math.floor(Math.random() * 8999)}`,
        status: 'applied',
        paymentConfirmed: false,
        appliedAt: now,
        updatedAt: now,
      });
    }

    // ── 여성 루프 (count명) ──────────────────────
    for (let i = 1; i <= count; i++) {
      const now = FieldValue.serverTimestamp();
      const fId = `dummy_female_${i}_${ts + i + 10000}`;
      const fUserId = `user_f_${i}_${ts + i + 10000}`;
      const fName = generateName('female');

      // 남성 기준 랜덤 연도에서 +1~3 오프셋 적용
      const baseMaleYear = maleStart + Math.floor(Math.random() * (maleEnd - maleStart + 1));
      const fBirth = generateFemaleBirthDate(baseMaleYear);
      const fFullYear = parseInt(fBirth.split('-')[0]);
      const fAge = new Date().getFullYear() - fFullYear + 1;

      batch.set(adminDb.collection('applications').doc(fId), {
        userId: fUserId,
        sessionId,
        name: fName,
        age: fAge,
        birthDate: fBirth,
        gender: 'female',
        job: getRandom(FEMALE_JOBS),
        residence: getRandom(DUMMY_LOCATIONS),
        height: 158 + Math.floor(Math.random() * 13), // 158~170cm
        phone: `010-${1000 + Math.floor(Math.random() * 8999)}-${1000 + Math.floor(Math.random() * 8999)}`,
        status: 'applied',
        paymentConfirmed: false,
        appliedAt: now,
        updatedAt: now,
      });
    }

    // applied 상태는 커운터에 영향없음 (커운터 증가 없음)
    await batch.commit();

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Seed dummy API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
