import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/requestAuth';
import { loadConfirmedParticipants, isConfirmedParticipant, isAdminUser, birthYearOf } from '@/lib/sessionParticipants';

/**
 * 기수 참가자 목록 (로그인 필수).
 * - 그 기수 확정 참가자·관리자: 매칭 결과/투표 화면에 필요한 항목(슬롯·성별·나이대·직업·키·지역·사진)
 * - 그 외 로그인 회원: 매칭 커플 표시용 슬롯·성별만
 * 이름·전화번호·생년월일 전체·재직증명서는 어떤 경우에도 주지 않는다.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getRequestUser(req);
    if (!requester) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { id } = await params;
    const [participants, isParticipant, isAdmin] = await Promise.all([
      loadConfirmedParticipants(id),
      isConfirmedParticipant(id, requester.uid),
      isAdminUser(requester.uid),
    ]);
    const full = isParticipant || isAdmin;

    const list = participants.map(({ appId, userId, app, user }) => {
      const base = { id: appId, userId, gender: app.gender, slotNumber: app.slotNumber || 0, isDarkTemplar: app.isDarkTemplar === true };
      if (!full) return base;
      const rawBirth = app.birthDate || user.birthDate;
      return {
        ...base,
        birthDate: rawBirth ? birthYearOf(rawBirth) : '',
        age: app.age || user.age || null,
        job: user.admin_job || user.job || app.job || '',
        displayJob: app.displayJob || user.admin_job || user.job || app.job || '',
        height: app.height || user.height || '',
        residence: app.residence || '',
        attendanceStatus: app.attendanceStatus || null,
        photos: (user.photos?.length ? user.photos : app.photos) || [],
      };
    });

    return NextResponse.json({ full, participants: list });
  } catch (error: any) {
    console.error('[Participants API]', error);
    return NextResponse.json({ error: '참가자 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
