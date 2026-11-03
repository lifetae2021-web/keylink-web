import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

/** Authorization: Bearer <Firebase ID 토큰>을 검증한다. 없거나 잘못됐으면 null. */
export async function getRequestUser(req: NextRequest): Promise<{ uid: string; isAnonymous: boolean } | null> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(header.split('Bearer ')[1]);
    return { uid: decoded.uid, isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous' };
  } catch {
    return null;
  }
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
