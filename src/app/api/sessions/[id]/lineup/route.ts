import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getRequestUser } from '@/lib/requestAuth';
import { loadConfirmedParticipants, isTestParticipant, isConfirmedParticipant, isAdminUser, birthYearOf, shuffled, Gender } from '@/lib/sessionParticipants';

/**
 * 라인업 API (로그인 필수).
 * 행사 전에는 그 기수 확정 참가자·관리자만, 행사가 끝난(completed) 기수는 로그인 회원 누구나 볼 수 있다
 * ('참가 확정자 전용 시크릿 라인업' / '전체 라인업은 행사 후 매칭 결과 페이지에서').
 * 슬롯 번호·나이대만 슬롯별로 주고, 직업·키·흡연·음주·종교는 순서를 섞은 목록으로 줘서 특정 슬롯과 연결되지 않게 한다.
 * 확정 인원이 2명 이하인 성별은 항목 목록을 아예 보내지 않는다 (화면에서 '3인부터 공개'로 가림).
 */
const BLIND_MAX = 2;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getRequestUser(req);
    if (!requester) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { id } = await params;
    const sessionStatus = (await adminDb.doc(`sessions/${id}`).get()).data()?.status;
    if (sessionStatus !== 'completed') {
      const [isParticipant, isAdmin] = await Promise.all([isConfirmedParticipant(id, requester.uid), isAdminUser(requester.uid)]);
      if (!isParticipant && !isAdmin) {
        return NextResponse.json({ error: '참가 확정자만 볼 수 있는 라인업입니다.' }, { status: 403 });
      }
    }
    const participants = (await loadConfirmedParticipants(id)).filter(p => !isTestParticipant(p.appId, p.app));

    const build = (gender: Gender) => {
      const list = participants.filter(p => p.app.gender === gender);
      const rows = list.map(({ app, user }) => ({
        slotNumber: app.slotNumber || null,
        birthYear: birthYearOf(user.birthDate || app.birthDate),
      }));
      if (list.length <= BLIND_MAX) return { rows, attrs: null };
      return {
        rows,
        attrs: {
          job: shuffled(list.map(({ app, user }) => user.admin_job || user.job || app.job || '검토 중')),
          height: shuffled(list.map(({ app, user }) => (user.height ? `${user.height}` : app.height ? `${app.height}` : '비공개'))),
          smoking: shuffled(list.map(({ app, user }) => user.smoking || app.smoking || '비흡연')),
          drinking: shuffled(list.map(({ app, user }) => user.drinking || app.drinking || '안 마심')),
          religion: shuffled(list.map(({ app, user }) => user.religion || app.religion || '무교')),
        },
      };
    };

    return NextResponse.json(
      { male: build('male'), female: build('female') },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error: any) {
    console.error('[Lineup API]', error);
    return NextResponse.json({ error: '라인업을 불러오지 못했습니다.' }, { status: 500 });
  }
}
