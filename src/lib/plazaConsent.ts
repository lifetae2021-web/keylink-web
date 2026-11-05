import crypto from 'crypto';

// 키링 월드 입장 동의 기록 — plazaConsents/{key} (서버만 읽고 씀)
// key: 회원 'u:<uid>' / 비회원 'g:<광장 기기 id 해시>'
// 필수 3개(만 19세·이용 수칙·개인정보 수집)를 남긴다. AI 키키 대화의 해외 처리는 동의서에 표시하지 않고(사업자명 비노출 요청)
// 개인정보처리방침 공개로 처리(개인정보보호법 제28조의8 제1항 제3호) — 방침 개정 때 이전받는 자·국가를 반드시 반영.
// 2026-11-04.3: 회원 간 프로필 공개(1:1 성사 상대·열람 신청 회원에게 사진 등)를 개인정보 수집·이용(필수) 안내에 포함.
// ⚠️ 프로필 열람(유료) 기능 출시 때 '내 프로필 공개 끄기'(옵트아웃) 설정을 반드시 함께 제공할 것.
// 2026-11-05.1: 키키 대화, 말풍선·분수대 소원, 활동 기록(열쇠·반려동물·꾸미기), 개인정보처리방침 전문 링크(/privacy) 추가.
export const CONSENT_VERSION = '2026-11-05.1';

export const guestKeyOf = (dev: unknown) => {
  const d = String(dev ?? '');
  return /^[A-Za-z0-9_-]{8,64}$/.test(d) ? crypto.createHash('sha256').update('kl-npc-guest:' + d).digest('hex').slice(0, 24) : null;
};
export const consentKey = (who: { uid?: string | null; dev?: unknown }) => {
  if (who.uid) return 'u:' + who.uid;
  const g = guestKeyOf(who.dev);
  return g ? 'g:' + g : null;
};
