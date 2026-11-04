import crypto from 'crypto';

// 회원 uid → 광장 익명 키. Cloudflare 실시간 서버(plaza-cf/src/room.js anonKey)와 같은 방식이어야 한다.
// 다른 사람에게 보여도 uid를 되돌려 알 수 없고, 닉네임이 바뀌어도 같은 사람으로 구분된다(차단·신고용).
export function plazaKey(uid: string): string {
  return crypto.createHash('sha256').update('kl-plaza:' + uid).digest('hex').slice(0, 16);
}
