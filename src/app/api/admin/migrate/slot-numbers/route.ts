import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

/**
 * 기존 confirmed 참가자에게 slotNumber 일괄 배정
 * POST /api/admin/migrate/slot-numbers
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    // slotNumber가 없는 confirmed 참가자 전체 조회
    const snap = await adminDb.collection('applications')
      .where('status', '==', 'confirmed')
      .get();

    const toMigrate = snap.docs.filter(d => d.data().slotNumber == null);

    // 세션+성별 조합별로 그룹핑
    const groups: Record<string, { docId: string; appliedAt: FirebaseFirestore.Timestamp }[]> = {};
    toMigrate.forEach(d => {
      const data = d.data();
      const key = `${data.sessionId}__${data.gender}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ docId: d.id, appliedAt: data.appliedAt });
    });

    const batch = adminDb.batch();
    let count = 0;

    for (const key of Object.keys(groups)) {
      const [sessionId, gender] = key.split('__');

      // 이미 slotNumber가 있는 참가자 조회 (사용 중인 슬롯 파악)
      const existingSnap = await adminDb.collection('applications')
        .where('sessionId', '==', sessionId)
        .where('gender', '==', gender)
        .where('status', '==', 'confirmed')
        .get();

      const usedSlots = new Set<number>(
        existingSnap.docs
          .map(d => d.data().slotNumber)
          .filter((n): n is number => n != null)
      );

      // appliedAt 순으로 정렬 후 빈 슬롯 순서대로 배정
      const sorted = groups[key].sort((a, b) => {
        const at = a.appliedAt?.toMillis?.() ?? 0;
        const bt = b.appliedAt?.toMillis?.() ?? 0;
        return at - bt;
      });

      for (const item of sorted) {
        let slot = 1;
        while (usedSlots.has(slot)) slot++;
        usedSlots.add(slot);
        batch.update(adminDb.collection('applications').doc(item.docId), {
          slotNumber: slot,
        });
        count++;
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true, migrated: count });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
