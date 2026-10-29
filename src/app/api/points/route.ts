import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePointOwner, grantDailyVisit, rollDrop, claimDrop, mergeVisitorIntoMember, expireMemberPoints,
  VISITOR_COOKIE, VISITOR_POINT_CAP, MIN_REDEEM_POINTS,
} from '@/lib/points';

/**
 * 방문 포인트/떨어지는 포인트 API
 * action: 'visit' (하루 1회 방문 적립 + 회원이면 비회원 포인트 합치기/만료 처리)
 *         'roll'  (포인트를 떨어뜨릴지 서버가 결정)
 *         'claim' (떨어진 포인트 줍기)
 */
export async function POST(req: NextRequest) {
  try {
    const { action, dropId } = await req.json().catch(() => ({}));
    const { owner, visitorId, newVisitorId } = await resolvePointOwner(req);

    let body: Record<string, unknown>;
    if (action === 'visit') {
      let merged = 0;
      if (owner.kind === 'member') {
        if (visitorId) merged = await mergeVisitorIntoMember(owner.uid, visitorId);
        await expireMemberPoints(owner.uid);
      }
      const { granted, capped, balance } = await grantDailyVisit(owner);
      body = { granted, capped, merged, balance, isMember: owner.kind === 'member', visitorCap: VISITOR_POINT_CAP, minRedeem: MIN_REDEEM_POINTS };
    } else if (action === 'roll') {
      body = await rollDrop(owner);
    } else if (action === 'claim' && typeof dropId === 'string') {
      const { earned, balance } = await claimDrop(owner, dropId);
      body = { earned, balance, isMember: owner.kind === 'member', visitorCap: VISITOR_POINT_CAP };
    } else {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const res = NextResponse.json(body);
    if (newVisitorId) {
      res.cookies.set(VISITOR_COOKIE, newVisitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 400,
      });
    }
    return res;
  } catch (error: any) {
    console.error('[Points Error]', error);
    return NextResponse.json({ error: error.message || '포인트 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
