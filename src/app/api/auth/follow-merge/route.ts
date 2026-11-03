import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { resolveMergedAccount } from '@/lib/accountMerge';
import { getRequestUser } from '@/lib/requestAuth';

/** 다른 계정에 연결(합쳐짐)된 계정으로 로그인했을 때, 연결된 계정으로 로그인할 커스텀 토큰을 돌려준다. */
export async function POST(req: NextRequest) {
  try {
    const requester = await getRequestUser(req);
    if (!requester || requester.isAnonymous) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const target = await resolveMergedAccount(requester.uid);
    if (!target) return NextResponse.json({ error: '연결된 계정이 없습니다.' }, { status: 404 });
    return NextResponse.json({ token: await adminAuth.createCustomToken(target) });
  } catch (error: any) {
    console.error('[Follow Merge]', error);
    return NextResponse.json({ error: '계정 전환 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
