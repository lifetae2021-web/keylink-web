import { NextResponse } from 'next/server';
import { runPlazaRetention } from '@/lib/plazaPurge';

// Vercel Cron(vercel.json) — 매일 새벽 키링 월드의 보관 기간 끝난 기록을 지운다.
// Vercel이 'Authorization: Bearer <CRON_SECRET>'을 붙여 부른다. CRON_SECRET이 없으면 아무도 못 부른다.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const deleted = await runPlazaRetention();
    console.log('[cron plaza-retention]', deleted);
    return NextResponse.json({ ok: true, deleted });
  } catch (e: unknown) {
    console.error('[cron plaza-retention]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
