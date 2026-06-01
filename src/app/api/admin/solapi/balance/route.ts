import { NextResponse } from 'next/server';
import { getSolapiBalance } from '@/lib/sms';

export async function GET() {
  try {
    const balanceInfo = await getSolapiBalance();
    return NextResponse.json(balanceInfo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
