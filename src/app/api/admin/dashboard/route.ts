import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { format, subDays, startOfToday } from 'date-fns';

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (val?.toDate) return val.toDate();
  if (val?.seconds) return new Date(val.seconds * 1000);
  if (val?._seconds) return new Date(val._seconds * 1000);
  return null;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface CachedDashboard {
  data: any;
  ts: number;
}
let serverDashboardCache: CachedDashboard | null = null;
const SERVER_CACHE_TTL = 30 * 1000; // 30초 서버 인메모리 캐시

export async function GET() {
  try {
    if (serverDashboardCache && Date.now() - serverDashboardCache.ts < SERVER_CACHE_TTL) {
      return NextResponse.json({ success: true, data: serverDashboardCache.data, cached: true });
    }

    const now = new Date();
    const todayStart = startOfToday();

    // 1. 5개 핵심 컬렉션을 백엔드에서 병렬 조회 (Promise.all)
    const [usersSnap, appsSnap, votesSnap, sessionsSnap, analyticsSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('applications').get(),
      adminDb.collection('votes').get().catch(() => ({ size: 0, docs: [] })),
      adminDb.collection('sessions').get(),
      adminDb.collection('analytics').where('lastUpdated', '>=', subDays(now, 14)).get().catch(() => ({ docs: [] })),
    ]);

    // 2. 회원 통계 계산
    const dummyUserIds = new Set<string>();
    let maleCount = 0, femaleCount = 0, monthlyNewUsers = 0, prevMonthlyNewUsers = 0;
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const userPrevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const allUsers = usersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    allUsers.forEach((data: any) => {
      const isDummy = data.isDummy === true || data.id.startsWith('dummy') || data.id.startsWith('user_m_') || data.id.startsWith('user_f_');
      if (isDummy) {
        dummyUserIds.add(data.id);
        return;
      }
      const g = data.gender;
      if (g === 'male') maleCount++;
      else if (g === 'female') femaleCount++;
      const created = toDate(data.createdAt);
      if (created && created >= thisMonthStart) monthlyNewUsers++;
      else if (created && created >= userPrevMonthStart) prevMonthlyNewUsers++;
    });

    // 3. 신청서 및 일별 차트 데이터
    const allApps = appsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const dayMap: Record<string, { applicants: number; matches: number; pv: number; uv: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = subDays(now, i);
      const dateKey = format(d, 'yyyy-MM-dd');
      dayMap[dateKey] = { applicants: 0, matches: 0, pv: 0, uv: 0 };
    }

    const appMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const appPrevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let weeklyApps = 0, prevWeeklyApps = 0, confirmedCount = 0, monthlyApps = 0, prevMonthlyApps = 0;

    allApps.forEach((app: any) => {
      const d = toDate(app.appliedAt);
      if (!d) return;
      const key = format(d, 'yyyy-MM-dd');
      if (dayMap[key]) {
        dayMap[key].applicants++;
        weeklyApps++;
      }
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (daysAgo >= 7 && daysAgo <= 13) prevWeeklyApps++;
      if (d >= appMonthStart) monthlyApps++;
      else if (d >= appPrevMonthStart) prevMonthlyApps++;
      if (app.status === 'confirmed' || app.paymentConfirmed === true) {
        confirmedCount++;
        if (dayMap[key]) dayMap[key].matches++;
      }
    });

    // 4. 매칭 커플 (votes)
    let matchCount = votesSnap.size || 0;
    let monthlyMatchCount = 0, prevMonthlyMatchCount = 0;
    const voteMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const votePrevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (votesSnap.docs) {
      votesSnap.docs.forEach((doc: any) => {
        const d = toDate(doc.data().submittedAt);
        if (d && d >= voteMonthStart) monthlyMatchCount++;
        else if (d && d >= votePrevMonthStart) prevMonthlyMatchCount++;
      });
    }

    // 5. 기수 (sessions) 매출 및 예정 기수
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    let monthlyRevenue = 0, prevMonthlyRevenue = 0;
    const sessionMap: Record<string, string> = {};

    sessionsSnap.docs.forEach((doc: any) => {
      const s = doc.data();
      sessionMap[doc.id] = `${s.region === 'busan' ? '부산' : '창원'} ${s.episodeNumber}기`;
      if (s.isTest) return;

      const eventDate = toDate(s.eventDate);
      if (!eventDate) return;

      const confirmedSessionApps = allApps.filter(
        (a: any) => a.sessionId === doc.id &&
          (a.status === 'confirmed' || (a.paymentConfirmed === true && !['applied', 'canceled', 'rejected'].includes(a.status))) &&
          !(a.userId?.startsWith('dummy') || a.userId?.startsWith('user_m_') || a.userId?.startsWith('user_f_') || a.id?.startsWith('dummy') || a.isDummy === true || dummyUserIds.has(a.userId))
      );

      const sessionRevenue = confirmedSessionApps.reduce((sum, app: any) => {
        const isRefunded = app.isManualRefund === true || app.status === 'refunded' || (app.isRefundDeposit === true && app.attendanceStatus === 'present');
        const isRefundPending = app.status !== 'refunded' && app.isManualRefund !== true && app.isRefundDeposit === true && (app.attendanceStatus === undefined || app.attendanceStatus === null || app.attendanceStatus === 'none' || !app.attendanceStatus);
        if (isRefunded || isRefundPending) return sum;
        const malePrice = app.maleOption === 'safe' ? 60000 : (s.malePrice || 49000);
        const femalePrice = app.femaleOption === 'group' ? 24000 : (s.femalePrice || 29000);
        const basePrice = (app.amountPaid !== undefined && app.amountPaid !== null && app.amountPaid !== '')
          ? Number(app.amountPaid)
          : (app.price !== undefined && app.price !== null && app.price !== '')
            ? Number(app.price)
            : (app.gender === 'male' ? malePrice : femalePrice);
        const refunded = Number(app.refundedAmount || 0);
        return sum + Math.max(0, basePrice - refunded);
      }, 0);

      if (eventDate >= monthStart && eventDate < nextMonthStart) {
        monthlyRevenue += sessionRevenue;
      } else if (eventDate >= prevMonthStart && eventDate < monthStart) {
        prevMonthlyRevenue += sessionRevenue;
      }
    });

    const upcomingEvents = sessionsSnap.docs
      .map((d: any) => {
        const s = { id: d.id, ...d.data() };
        const confirmedSessionApps = allApps.filter(
          (a: any) => a.sessionId === d.id &&
            (a.status === 'confirmed' || (a.paymentConfirmed === true && !['applied', 'canceled', 'rejected'].includes(a.status)))
        );
        let realMale = 0, realFemale = 0;
        confirmedSessionApps.forEach((a: any) => {
          if (a.gender === 'male') realMale++;
          else if (a.gender === 'female') realFemale++;
        });
        return { ...s, currentMale: realMale, currentFemale: realFemale };
      })
      .filter((s: any) => {
        const d = toDate(s.eventDate);
        return d && d >= todayStart;
      })
      .sort((a: any, b: any) => (toDate(a.eventDate)?.getTime() || 0) - (toDate(b.eventDate)?.getTime() || 0))
      .slice(0, 3)
      .map((s: any) => ({
        ...s,
        eventDate: toDate(s.eventDate)?.toISOString() || null
      }));

    // 6. 방문자 통계 (analytics)
    const statsMap: Record<string, any> = {};
    if (analyticsSnap.docs) {
      analyticsSnap.docs.forEach((doc: any) => {
        statsMap[doc.id] = doc.data();
      });
    }

    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');

    if (!statsMap[todayStr]) {
      try {
        const todayDoc = await adminDb.doc(`analytics/${todayStr}`).get();
        if (todayDoc.exists) statsMap[todayStr] = todayDoc.data();
      } catch {}
    }
    if (!statsMap[yesterdayStr]) {
      try {
        const yesterdayDoc = await adminDb.doc(`analytics/${yesterdayStr}`).get();
        if (yesterdayDoc.exists) statsMap[yesterdayStr] = yesterdayDoc.data();
      } catch {}
    }

    let todayPV = 0, todayUV = 0, yesterdayPV = 0, yesterdayUV = 0;
    Object.entries(statsMap).forEach(([dateStr, data]: [string, any]) => {
      if (dayMap[dateStr]) {
        dayMap[dateStr].pv = data?.pv || 0;
        dayMap[dateStr].uv = data?.uv || 0;
      }
      if (dateStr === todayStr) {
        todayPV = data?.pv || 0;
        todayUV = data?.uv || 0;
      } else if (dateStr === yesterdayStr) {
        yesterdayPV = data?.pv || 0;
        yesterdayUV = data?.uv || 0;
      }
    });

    const chartData = Object.entries(dayMap).map(([dateStr, v]) => ({
      day: DAY_LABELS[new Date(dateStr).getDay()],
      ...v,
    }));

    // 7. 최근 가입자 5명
    const recentUsers = allUsers
      .sort((a: any, b: any) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
      .slice(0, 5)
      .map((u: any) => ({
        ...u,
        createdAt: toDate(u.createdAt)?.toISOString() || null
      }));

    // 8. 최근 신청 5건
    const recentApps = allApps
      .sort((a: any, b: any) => (toDate(b.appliedAt)?.getTime() || 0) - (toDate(a.appliedAt)?.getTime() || 0))
      .slice(0, 5)
      .map((app: any) => ({
        ...app,
        appliedAt: toDate(app.appliedAt)?.toISOString() || null,
        sessionName: sessionMap[app.sessionId] || '알 수 없음'
      }));

    const resultPayload = {
      stats: {
        totalUsers: usersSnap.size, monthlyNewUsers, prevMonthlyNewUsers,
        weeklyApps, prevWeeklyApps, monthlyApps, prevMonthlyApps,
        totalApps: allApps.length, matchCount, monthlyMatchCount,
        prevMonthlyMatchCount, monthlyRevenue, prevMonthlyRevenue,
        todayPV, todayUV, yesterdayPV, yesterdayUV
      },
      genderData: [
        { name: '남성', value: maleCount + femaleCount > 0 ? Math.round((maleCount / (maleCount + femaleCount)) * 100) : 50, color: '#60a5fa' },
        { name: '여성', value: maleCount + femaleCount > 0 ? Math.round((femaleCount / (maleCount + femaleCount)) * 100) : 50, color: '#FF6F61' },
      ],
      chartData,
      upcomingEvents,
      recentUsers,
      recentApps,
    };

    serverDashboardCache = { data: resultPayload, ts: Date.now() };

    return NextResponse.json({ success: true, data: resultPayload });
  } catch (error: any) {
    console.error('[Admin Dashboard API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
