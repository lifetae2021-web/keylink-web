import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { subDays } from 'date-fns';

export async function GET() {
  try {
    const now = new Date();
    // 최근 24시간 데이터만 조회
    const yesterday = subDays(now, 1);
    
    const snapshot = await adminDb.collection('visitor_logs')
      .where('timestamp', '>=', yesterday)
      .orderBy('timestamp', 'desc')
      .get();

    const logs: any[] = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    // 1. Top Pages 계산
    const pageCounts: Record<string, number> = {};
    logs.forEach(log => {
      const p = log.path || '/';
      pageCounts[p] = (pageCounts[p] || 0) + 1;
    });

    const topPages = Object.entries(pageCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 2. 방문자 목록 집계 (최근 접속 순)
    const visitorsMap: Record<string, any> = {};
    logs.forEach(log => {
      const vId = log.visitorId;
      if (!vId) return;

      if (!visitorsMap[vId]) {
        visitorsMap[vId] = {
          visitorId: vId,
          userId: log.userId || null,
          lastSeenAt: log.timestamp?.toDate() || new Date(),
          paths: new Set<string>(),
          hitCount: 0,
        };
      }
      visitorsMap[vId].paths.add(log.path);
      visitorsMap[vId].hitCount += 1;
      // 이미 timestamp desc로 정렬되어 있으므로 첫 번째 요소가 가장 최근 접속임 (단, Set 추가 및 hitCount 누적은 계속 진행)
    });

    const recentVisitors = Object.values(visitorsMap).map(v => ({
      ...v,
      paths: Array.from(v.paths).slice(0, 5), // 최대 5개 경로만 노출
    })).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    .slice(0, 50); // 최근 50명만 노출

    return NextResponse.json({
      topPages,
      recentVisitors,
      totalLogs: logs.length
    });
  } catch (error: any) {
    console.error('[Admin Analytics Details API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
