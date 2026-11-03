import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { sendSMS } from '@/lib/sms';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 우선 대기 회원에게 '이상형 제안' 문자 발송 (관리자 전용).
 * - 선택한 기수(날짜)로 제안 문자를 보내고, 회원의 제안 횟수(proposalCount)를 1 올린다.
 * - 제안 이력(proposalHistory)에 기수·날짜를 남긴다. (마케팅 수신 동의는 가입 시 받아둔 전제)
 */
const SENDER_LINK = 'https://www.keylink.kr';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const callerRole = (await adminDb.doc(`users/${decoded.uid}`).get()).data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'super_admin') {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const { userId, sessionId } = await req.json();
    if (!userId || !sessionId) {
      return NextResponse.json({ error: '회원과 기수를 선택해 주세요.' }, { status: 400 });
    }

    const [userSnap, sessionSnap] = await Promise.all([
      adminDb.doc(`users/${userId}`).get(),
      adminDb.doc(`sessions/${sessionId}`).get(),
    ]);
    const user = userSnap.data();
    const session = sessionSnap.data();
    if (!user) return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 });
    if (!session) return NextResponse.json({ error: '기수 정보를 찾을 수 없습니다.' }, { status: 404 });
    const phone = (user.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return NextResponse.json({ error: '회원 연락처가 없습니다.' }, { status: 400 });

    // 날짜·요일·시간 (관리자가 저장한 '이상형 추천 제안' 템플릿의 변수 치환용)
    const eventDate = session.eventDate?.toDate ? session.eventDate.toDate() : session.eventDate ? new Date(session.eventDate) : null;
    const fmt = eventDate
      ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).formatToParts(eventDate)
      : [];
    const part = (t: string) => fmt.find(p => p.type === t)?.value || '';
    const dateLabel = eventDate ? `${part('month')}/${part('day')}` : '';
    const weekday = part('weekday');
    const timeLabel = eventDate ? `${part('hour')}:${part('minute')}` : '';
    const name = user.name || '회원';

    // 저장된 '이상형 추천 제안' 템플릿을 불러와 변수를 채운다 (관리자가 문구를 바꾸면 그대로 반영됨)
    const tplSnap = await adminDb.collection('smsTemplates').where('name', '==', '이상형 추천 제안').limit(1).get();
    const template: string | null = tplSnap.empty ? null : (tplSnap.docs[0].data().content || null);
    const message = (template
      || `안녕하세요 키링크입니다 :)\n{{날짜}} ({{요일}}) {{시간}} 소개팅에 이상형에 부합하는 분들이 계셔 연락드렸어요! 참여 가능여부 알려주세요 :)\n${SENDER_LINK}`)
      .replace(/\{\{?날짜\}?\}/g, dateLabel)
      .replace(/\{\{?요일\}?\}/g, weekday)
      .replace(/\{\{?시간\}?\}/g, timeLabel)
      .replace(/\{\{?이름\}?\}/g, name);

    const result = await sendSMS({ to: phone, text: message });
    if (!result?.success) {
      return NextResponse.json({ error: '문자 발송에 실패했습니다.' }, { status: 502 });
    }

    await adminDb.doc(`users/${userId}`).update({
      proposalCount: FieldValue.increment(1),
      lastProposedAt: FieldValue.serverTimestamp(),
      proposalHistory: FieldValue.arrayUnion({
        sessionId,
        sessionTitle: session.title || '',
        episodeNumber: session.episodeNumber || null,
        dateLabel,
        sentAt: new Date().toISOString(),
      }),
    });

    const proposalCount = (user.proposalCount || 0) + 1;
    return NextResponse.json({ success: true, proposalCount, dateLabel });
  } catch (error: any) {
    console.error('[Propose API]', error);
    return NextResponse.json({ error: error.message || '제안 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
