import { NextResponse } from 'next/server';
import { getActiveTheme } from '@/lib/plazaTheme';
import { DEFAULT_THEME } from '../../../../../public/plaza/themes.js';

// 키링 월드가 입장할 때 지금 테마를 묻는다(누구나, 짧게 캐시)
export async function GET() {
  try {
    return NextResponse.json({ theme: await getActiveTheme() }, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ theme: DEFAULT_THEME });
  }
}
