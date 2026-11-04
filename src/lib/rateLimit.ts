import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// 시도 횟수 제한(반복 대입 공격 방지). rateLimits/{해시} 문서에 최근 시도 시각을 남겨 창(window) 안의 횟수를 센다.
// IP·입력값은 해시로만 저장한다. Firestore 규칙에 rateLimits 규칙이 없으므로 클라이언트는 접근 불가(서버 전용).
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function hitLimit(bucket: string, key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  const ref = adminDb.doc(`rateLimits/${sha(bucket + ':' + key)}`);
  const now = Date.now();
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const hits: number[] = ((snap.data()?.hits as number[]) || []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      return { ok: false, retryAfterSec: Math.ceil((hits[0] + windowMs - now) / 1000) };
    }
    hits.push(now);
    tx.set(ref, { hits, bucket, expireAt: new Date(now + windowMs) });
    return { ok: true, retryAfterSec: 0 };
  });
}

// 여러 제한을 한 번에 검사 — 하나라도 넘으면 429 응답을 돌려준다(통과하면 null)
export async function rateLimitOr429(checks: Array<[bucket: string, key: string, limit: number, windowMs: number]>): Promise<NextResponse | null> {
  for (const [bucket, key, limit, windowMs] of checks) {
    const r = await hitLimit(bucket, key, limit, windowMs);
    if (!r.ok) {
      const min = Math.max(1, Math.ceil(r.retryAfterSec / 60));
      return NextResponse.json(
        { error: `시도 횟수가 너무 많아요. ${min}분 후에 다시 시도해 주세요.` },
        { status: 429, headers: { 'Retry-After': String(r.retryAfterSec) } },
      );
    }
  }
  return null;
}
