import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { claimKeyReward, readKeyState, KEY_DAILY_POINTS, KEY_STREAK_FOR_COUPON, KEY_COUPON_VALUE } from '@/lib/plazaKeys';

// 키링 월드 황금 열쇠: GET 내 보상 상태(잠금 해제된 꾸미기 등) / POST 오늘 8개 다 모았으면 보상 받기
// 열쇠를 실제로 주웠는지는 실시간 서버(워커)가 위치로 확인해 기록한 것만 센다.
async function uidOf(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { const d = await adminAuth.verifyIdToken(h.split('Bearer ')[1]); return d.firebase?.sign_in_provider === 'anonymous' ? null : d.uid; } catch { return null; }
}
const rules = { points: KEY_DAILY_POINTS, streakForCoupon: KEY_STREAK_FOR_COUPON, couponValue: KEY_COUPON_VALUE };

export async function GET(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ state: await readKeyState(uid), rules });
}

export async function POST(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ ...(await claimKeyReward(uid)), rules });
  } catch (e) {
    console.error('[plaza keys]', e);
    return NextResponse.json({ error: '보상 확인 중 문제가 생겼어요' }, { status: 502 });
  }
}
