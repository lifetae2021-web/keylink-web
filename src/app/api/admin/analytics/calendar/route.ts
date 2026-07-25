import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

interface CachedCalendar {
  data: Record<string, any>;
  ts: number;
}
const calendarCache: Record<string, CachedCalendar> = {};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month'); // format: YYYY-MM
    
    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7); // e.g. '2026-07'
    const isPastMonth = monthParam && monthParam < currentMonthStr;
    const cacheTtl = isPastMonth ? Infinity : 3 * 60 * 1000; // 과거 월은 무제한 캐시, 현재 월은 3분 캐시

    if (monthParam && calendarCache[monthParam]) {
      const cached = calendarCache[monthParam];
      if (Date.now() - cached.ts < cacheTtl) {
        return NextResponse.json({ success: true, data: cached.data, cached: true });
      }
    }
    
    let targetDate = new Date();
    if (monthParam) {
      targetDate = parseISO(`${monthParam}-01T00:00:00Z`);
    }

    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);

    // Fetch visitor logs for the month with select to drastically reduce payload & memory
    const snapshot = await adminDb.collection('visitor_logs')
      .where('timestamp', '>=', start)
      .where('timestamp', '<=', end)
      .select('timestamp', 'visitorId', 'userId', 'path')
      .orderBy('timestamp', 'desc')
      .get();

    // Group logs by YYYY-MM-DD
    const groupedByDay: Record<string, Record<string, any>> = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp || !data.visitorId) return;

      const dateObj = data.timestamp.toDate();
      // Format to YYYY-MM-DD in KST
      const dateKey = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(dateObj).replace(/\. /g, '-').replace('.', '');

      if (!groupedByDay[dateKey]) {
        groupedByDay[dateKey] = {};
      }

      const vId = data.visitorId;
      if (!groupedByDay[dateKey][vId]) {
        groupedByDay[dateKey][vId] = {
          visitorId: vId,
          userId: data.userId || null,
          lastSeenAt: dateObj,
          paths: new Set<string>(),
          hitCount: 0,
        };
      }
      
      groupedByDay[dateKey][vId].paths.add(data.path || '/');
      groupedByDay[dateKey][vId].hitCount += 1;
    });

    // Collect all unique userIds to fetch names
    const allUserIds = new Set<string>();
    Object.values(groupedByDay).forEach(dayObj => {
      Object.values(dayObj).forEach(v => {
        if (v.userId) allUserIds.add(v.userId);
      });
    });

    // Fetch user names via chunked getAll requests (100x faster than individual get calls)
    const userNames: Record<string, string> = {};
    const uidArray = Array.from(allUserIds);
    for (let i = 0; i < uidArray.length; i += 100) {
      const chunk = uidArray.slice(i, i + 100);
      const refs = chunk.map(uid => adminDb.doc(`users/${uid}`));
      try {
        const docs = await adminDb.getAll(...refs, { fieldMask: ['name'] });
        docs.forEach((doc: any, idx: number) => {
          if (doc.exists) {
            userNames[chunk[idx]] = doc.data()?.name || '이름 없음';
          }
        });
      } catch (e) {
        // fallback ignore
      }
    }

    // Format final response
    const result: Record<string, any> = {};
    
    Object.entries(groupedByDay).forEach(([dateKey, visitorsMap]) => {
      const visitorsArray = Object.values(visitorsMap).map(v => ({
        ...v,
        name: v.userId ? (userNames[v.userId] || '알 수 없음') : '비회원',
        paths: Array.from(v.paths).slice(0, 10), // Limit to top 10 paths
      })).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

      result[dateKey] = {
        uv: visitorsArray.length,
        visitors: visitorsArray
      };
    });

    if (monthParam) {
      calendarCache[monthParam] = { data: result, ts: Date.now() };
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Admin Analytics Calendar API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

