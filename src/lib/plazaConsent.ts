import crypto from 'crypto';

// 키링 월드 입장 동의 기록 — plazaConsents/{key} (서버만 읽고 씀)
// key: 회원 'u:<uid>' / 비회원 'g:<광장 기기 id 해시>'
// 필수 3개(만 19세·이용 수칙·개인정보 수집)를 남긴다. AI 키키 대화의 해외 처리(Anthropic 미국)는 별도 동의 없이
// 개인정보 항목 안내 + 개인정보처리방침 공개로 처리(개인정보보호법 제28조의8 제1항 제3호) — 방침 개정 때 반드시 반영.
export const CONSENT_VERSION = '2026-11-04';

export const guestKeyOf = (dev: unknown) => {
  const d = String(dev ?? '');
  return /^[A-Za-z0-9_-]{8,64}$/.test(d) ? crypto.createHash('sha256').update('kl-npc-guest:' + d).digest('hex').slice(0, 24) : null;
};
export const consentKey = (who: { uid?: string | null; dev?: unknown }) => {
  if (who.uid) return 'u:' + who.uid;
  const g = guestKeyOf(who.dev);
  return g ? 'g:' + g : null;
};
