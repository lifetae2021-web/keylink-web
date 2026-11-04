import crypto from 'crypto';
import { promisify } from 'util';

// 비회원 비밀번호(PIN) 일방향 해시 — 원래 숫자는 저장하지 않는다(개인정보 안전성 확보조치 기준).
// 저장 형식: scrypt$<saltHex>$<hashHex>  (솔트는 사용자마다 무작위 16바이트)
const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEYLEN = 32;

export async function hashGuestPw(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pw, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyGuestPwHash(pw: string, stored: unknown): Promise<boolean> {
  if (typeof stored !== 'string') return false;
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// 사용자 문서 기준 확인: 해시(guestPwHash)가 있으면 해시로, 아직 변환 전(guestPw 평문)이면 평문으로 비교
// legacy=true 면 로그인 성공 직후 해시로 바꿔 저장해야 한다.
export async function checkGuestPw(pw: string, data: Record<string, unknown>): Promise<{ ok: boolean; legacy: boolean }> {
  if (data.guestPwHash) return { ok: await verifyGuestPwHash(pw, data.guestPwHash), legacy: false };
  if (data.guestPw != null && data.guestPw !== '') {
    const a = Buffer.from(String(data.guestPw)), b = Buffer.from(pw);
    return { ok: a.length === b.length && crypto.timingSafeEqual(a, b), legacy: true };
  }
  return { ok: false, legacy: false };
}
