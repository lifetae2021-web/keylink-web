import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { sendSMS } from '@/lib/sms';

/**
 * 보증금 환불 계좌 받기
 * 대상: 보증금 환불 대상(isRefundDeposit) + 정상 출석(present) + 아직 환불 처리 안 됨 + 행사 후 30일 이내
 * GET  → 내 환불 대상 목록(계좌는 뒷자리만)
 * POST → 계좌 저장 + 운영자에게 문자 발송
 */

const ADMIN_PHONE = '01091301577';
const WINDOW_DAYS = 30;
const MAX_SUBMITS = 5;

const REFUND_BANKS = [
  '카카오뱅크', '국민', '신한', '우리', '하나', '농협', '기업', '토스뱅크', '케이뱅크',
  '새마을금고', '우체국', '부산', '경남', '대구', 'iM뱅크', 'SC제일', '씨티', '수협', '신협', '광주', '전북', '제주', '산업',
];

async function getUid(req: NextRequest) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { return (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid as string; } catch { return null; }
}

const toDate = (v: any): Date | null => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

async function eligibleApps(uid: string) {
  const snap = await adminDb.collection('applications')
    .where('userId', '==', uid)
    .where('isRefundDeposit', '==', true)
    .get();
  const out: { ref: FirebaseFirestore.DocumentReference; app: any; session: any; eventDate: Date | null }[] = [];
  for (const d of snap.docs) {
    const a = d.data();
    if (a.attendanceStatus !== 'present') continue;
    if (a.status === 'refunded' || a.isManualRefund === true || Number(a.refundedAmount || 0) > 0 || a.refundPaidAt) continue;
    const s = (await adminDb.collection('sessions').doc(a.sessionId).get()).data() || {};
    const eventDate = toDate(s.eventDate);
    if (!eventDate || Date.now() - eventDate.getTime() > WINDOW_DAYS * 86400000) continue;
    out.push({ ref: d.ref, app: a, session: s, eventDate });
  }
  return out;
}

const amountOf = (a: any) => Number(a.amountPaid ?? a.price ?? 0) || 0;
const mask = (acc: string) => (acc.length <= 4 ? acc : '•'.repeat(Math.min(6, acc.length - 4)) + acc.slice(-4));

export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  try {
    const list = await eligibleApps(uid);
    return NextResponse.json({
      banks: REFUND_BANKS,
      items: list.map(({ ref, app, session, eventDate }) => ({
        appId: ref.id,
        sessionTitle: session.title || '',
        eventDate: eventDate?.toISOString() ?? null,
        amount: amountOf(app),
        submitted: app.refundAccount
          ? { bank: app.refundAccount.bank, account: mask(app.refundAccount.account), holder: app.refundAccount.holder, at: toDate(app.refundAccount.submittedAt)?.toISOString() ?? null }
          : null,
      })),
    });
  } catch (e: any) {
    console.error('[refund GET]', e);
    return NextResponse.json({ error: '불러오지 못했어요.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const appId = String(body.appId || '');
    const bank = String(body.bank || '').trim();
    const account = String(body.account || '').replace(/[^0-9]/g, '');
    const holder = String(body.holder || '').trim().replace(/\s+/g, ' ');

    if (!REFUND_BANKS.includes(bank)) return NextResponse.json({ error: '은행을 골라 주세요.' }, { status: 400 });
    if (account.length < 8 || account.length > 20) return NextResponse.json({ error: '계좌번호를 다시 확인해 주세요.' }, { status: 400 });
    if (!/^[가-힣a-zA-Z ]{2,20}$/.test(holder)) return NextResponse.json({ error: '예금주 이름을 확인해 주세요.' }, { status: 400 });

    const target = (await eligibleApps(uid)).find((x) => x.ref.id === appId);
    if (!target) return NextResponse.json({ error: '환불 대상 신청을 찾지 못했어요.' }, { status: 404 });

    const count = Number(target.app.refundAccount?.count || 0);
    if (count >= MAX_SUBMITS) return NextResponse.json({ error: '여러 번 바꾸셨어요. 운영진에게 문의해 주세요.' }, { status: 429 });

    await target.ref.update({
      refundAccount: { bank, account, holder, submittedAt: FieldValue.serverTimestamp(), count: count + 1 },
      updatedAt: FieldValue.serverTimestamp(),
    });

    const d = target.eventDate;
    const dateStr = d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
    const text = [
      `[키링크 환불계좌${count > 0 ? ' 수정' : ''}]`,
      `${target.session.title || ''} ${dateStr}`.trim(),
      `이름: ${target.app.name || ''}`,
      `은행: ${bank}`,
      `계좌: ${account}`,
      `예금주: ${holder}`,
      `결제액: ${amountOf(target.app).toLocaleString()}원`,
    ].join('\n');

    let smsSent = true;
    try { await sendSMS({ to: ADMIN_PHONE, text }); } catch (e) { smsSent = false; console.error('[refund SMS]', e); }
    await target.ref.update({ 'refundAccount.smsSent': smsSent });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[refund POST]', e);
    return NextResponse.json({ error: '저장하지 못했어요. 잠시 뒤 다시 해 주세요.' }, { status: 500 });
  }
}
