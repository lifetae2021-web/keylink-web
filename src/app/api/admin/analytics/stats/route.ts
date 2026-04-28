import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { subDays, format } from 'date-fns';

export async function GET() {
  try {
    const now = new Date();
    const stats: Record<string, any> = {};
    
    // 최근 14일 데이터 조회 (트렌드 분석용)
    const startDate = subDays(now, 14);
    const snapshot = await adminDb.collection('analytics')
      .where('lastUpdated', '>=', startDate)
      .get();

    snapshot.forEach(doc => {
      stats[doc.id] = doc.data();
    });

    // 만약 데이터가 없으면 오늘/어제 수동 조회 (lastUpdated가 없을 수도 있으므로)
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');

    if (!stats[todayStr]) {
      const todayDoc = await adminDb.collection('analytics').doc(todayStr).get();
      if (todayDoc.exists) stats[todayStr] = todayDoc.data();
    }
    if (!stats[yesterdayStr]) {
      const yesterdayDoc = await adminDb.collection('analytics').doc(yesterdayStr).get();
      if (yesterdayDoc.exists) stats[yesterdayStr] = yesterdayDoc.data();
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[Admin Analytics API] Error fetching stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
