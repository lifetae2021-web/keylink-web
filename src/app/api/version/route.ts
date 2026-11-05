import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/constants';

// 현재 배포 버전 — 사이트 메뉴가 없는 키링 월드(public/plaza) 화면이 관리자 버전 표시에 쓴다
export const dynamic = 'force-static';
export function GET() {
  return NextResponse.json({ version: APP_VERSION });
}
