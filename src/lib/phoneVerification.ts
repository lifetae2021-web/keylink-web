import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { sendSMS } from '@/lib/sms';
import { formatPhone, isValidMobile } from '@/lib/phone';

/**
 * 휴대폰 문자 인증
 * - 6자리 인증번호를 문자로 보내고(유효 3분, 오답 5회까지), 맞히면 30분짜리 1회용 인증 토큰을 발급한다.
 * - 토큰은 가입/연결 API에서 소비되어 users/{uid}.verifiedPhone 기록이나 기존 계정 연결에 쓰인다.
 * - 문자 요금 악용 방지: 번호당 재발송 60초 간격·하루 5회, IP당 하루 20회.
 * - 로컬 개발(NODE_ENV !== production)에서는 문자를 보내지 않고 인증번호를 응답/콘솔로 돌려준다. PHONE_OTP_LIVE=1이면 로컬에서도 실제 발송.
 */

const CODE_TTL_MS = 3 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_SENDS_PER_PHONE_PER_DAY = 5;
const MAX_SENDS_PER_IP_PER_DAY = 20;
const MAX_ATTEMPTS = 5;

// 테스트용 화이트리스트 번호: 하루 발송 횟수·IP 제한을 건너뛴다 (재발송 60초 간격은 유지).
// .env.local / Vercel 환경변수 PHONE_OTP_WHITELIST 에 콤마로 구분해 등록 (예: 01012345678,01099998888)
const OTP_WHITELIST = new Set(
  (process.env.PHONE_OTP_WHITELIST || '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean)
);

const OTP_SMS_DOMAIN = 'www.keylink.kr';
const IS_MOCK = process.env.NODE_ENV !== 'production' && process.env.PHONE_OTP_LIVE !== '1';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const DAY_MS = 24 * 60 * 60 * 1000;

export class PhoneVerificationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function sendVerificationCode(rawPhone: string, ip: string): Promise<{ devCode?: string }> {
  if (!isValidMobile(rawPhone)) throw new PhoneVerificationError('올바른 휴대폰 번호를 입력해 주세요.');
  const phone = formatPhone(rawPhone);
  const digits = phone.replace(/\D/g, '');
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const now = Date.now();

  const otpRef = adminDb.doc(`phoneOtps/${digits}`);
  const ipRef = adminDb.doc(`phoneOtpIps/${sha256(ip)}`);

  await adminDb.runTransaction(async (tx) => {
    const [otpSnap, ipSnap] = await Promise.all([tx.get(otpRef), tx.get(ipRef)]);
    const sends: number[] = (otpSnap.data()?.sends || []).filter((t: number) => now - t < DAY_MS);
    const ipSends: number[] = (ipSnap.data()?.sends || []).filter((t: number) => now - t < DAY_MS);

    const whitelisted = OTP_WHITELIST.has(digits);

    const last = sends[sends.length - 1];
    if (last && now - last < RESEND_INTERVAL_MS) {
      throw new PhoneVerificationError(`${Math.ceil((RESEND_INTERVAL_MS - (now - last)) / 1000)}초 후에 다시 요청해 주세요.`, 429);
    }
    if (!whitelisted && sends.length >= MAX_SENDS_PER_PHONE_PER_DAY) {
      throw new PhoneVerificationError('오늘 이 번호로 보낼 수 있는 인증번호 횟수를 넘었어요. 내일 다시 시도해 주세요.', 429);
    }
    if (!whitelisted && ipSends.length >= MAX_SENDS_PER_IP_PER_DAY) {
      throw new PhoneVerificationError('인증 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', 429);
    }

    tx.set(otpRef, { codeHash: sha256(`${digits}:${code}`), expiresAt: now + CODE_TTL_MS, attempts: 0, sends: [...sends, now] });
    tx.set(ipRef, { sends: [...ipSends, now] });
  });

  if (IS_MOCK) {
    console.log(`[Phone OTP mock] ${phone} → ${code}`);
    return { devCode: code };
  }

  try {
    // 마지막 줄은 휴대폰 자동입력용 (안드로이드 크롬 WebOTP / iOS 사파리가 이 도메인에서만 자동으로 채움)
    await sendSMS({ to: digits, text: `[키링크] 인증번호 [${code}]를 입력해 주세요.\n\n@${OTP_SMS_DOMAIN} #${code}` });
  } catch (err: any) {
    console.error('[Phone OTP] SMS send failed:', err?.message);
    throw new PhoneVerificationError('인증번호 문자를 보내지 못했어요. 잠시 후 다시 시도해 주세요.', 502);
  }
  return {};
}

/** 인증번호가 맞으면 1회용 인증 토큰을 발급한다. */
export async function checkVerificationCode(rawPhone: string, code: string): Promise<{ phone: string; token: string }> {
  if (!isValidMobile(rawPhone)) throw new PhoneVerificationError('올바른 휴대폰 번호를 입력해 주세요.');
  const phone = formatPhone(rawPhone);
  const digits = phone.replace(/\D/g, '');
  const otpRef = adminDb.doc(`phoneOtps/${digits}`);
  const now = Date.now();

  const ok = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(otpRef);
    const d = snap.data();
    if (!d?.codeHash || d.expiresAt < now) {
      throw new PhoneVerificationError('인증번호가 만료되었어요. 다시 받아 주세요.');
    }
    if (d.attempts >= MAX_ATTEMPTS) {
      throw new PhoneVerificationError('인증번호를 여러 번 틀렸어요. 인증번호를 다시 받아 주세요.');
    }
    const match = d.codeHash === sha256(`${digits}:${String(code).trim()}`);
    tx.update(otpRef, match ? { codeHash: null } : { attempts: d.attempts + 1 });
    return match;
  });
  if (!ok) throw new PhoneVerificationError('인증번호가 일치하지 않아요.');

  const token = crypto.randomBytes(32).toString('hex');
  await adminDb.doc(`phoneOtpTokens/${sha256(token)}`).set({ phone, expiresAt: now + TOKEN_TTL_MS, usedBy: null });
  return { phone, token };
}

/** 토큰이 유효한지 확인만 하고 번호를 돌려준다 (소비하지 않음). */
export async function peekVerificationToken(token: string): Promise<string> {
  const snap = await adminDb.doc(`phoneOtpTokens/${sha256(String(token))}`).get();
  const d = snap.data();
  if (!d || d.usedBy || d.expiresAt < Date.now()) {
    throw new PhoneVerificationError('휴대폰 인증이 만료되었어요. 다시 인증해 주세요.');
  }
  return d.phone;
}

/** 트랜잭션 안에서 토큰을 소비한다. 이미 쓴 토큰이거나 만료됐으면 에러. */
export async function consumeVerificationToken(tx: FirebaseFirestore.Transaction, token: string, uid: string): Promise<string> {
  const ref = adminDb.doc(`phoneOtpTokens/${sha256(String(token))}`);
  const snap = await tx.get(ref);
  const d = snap.data();
  if (!d || d.usedBy || d.expiresAt < Date.now()) {
    throw new PhoneVerificationError('휴대폰 인증이 만료되었어요. 다시 인증해 주세요.');
  }
  tx.update(ref, { usedBy: uid, usedAt: Date.now() });
  return d.phone;
}
