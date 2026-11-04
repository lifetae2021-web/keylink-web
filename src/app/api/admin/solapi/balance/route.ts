import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getSolapiBalance } from '@/lib/sms';

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (gate instanceof NextResponse) return gate;
    const balanceInfo = await getSolapiBalance();
    return NextResponse.json(balanceInfo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
