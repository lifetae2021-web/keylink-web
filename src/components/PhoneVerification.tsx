'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { formatPhone, isValidMobile } from '@/lib/phone';

/** /api/auth/phone/verify가 알려주는 "이 번호로 가입된 다른 계정" (가린 정보) */
export interface ExistingAccount {
  maskedName: string;
  method: 'kakao' | 'google' | 'id';
  maskedUsername: string | null;
  joinedAt: string | null;
  canLink: boolean;
}

export interface PhoneVerifyResult {
  token: string;
  phone: string;
  existing: ExistingAccount | null;
}

const METHOD_LABEL: Record<ExistingAccount['method'], string> = { kakao: '카카오', google: '구글', id: '아이디' };

export function describeExisting(e: ExistingAccount) {
  const how = e.method === 'id' && e.maskedUsername ? `아이디(${e.maskedUsername})` : METHOD_LABEL[e.method];
  return `${e.maskedName}님 · ${how}로 가입${e.joinedAt ? ` · ${e.joinedAt}` : ''}`;
}

async function authHeader(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  return u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {};
}

/** 인증된 번호를 로그인한 본인 계정에 기록 (비회원 계정 포함) */
export async function claimVerifiedPhone(token: string) {
  const res = await fetch('/api/auth/phone/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '휴대폰 번호 저장에 실패했어요.');
}

/** 지금 로그인한 계정을 휴대폰 인증으로 찾은 기존 계정에 연결하고, 기존 계정으로 다시 로그인한다. */
export async function linkToExistingAccount(token: string) {
  const res = await fetch('/api/auth/link-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '계정 연결에 실패했어요.');
  await signInWithCustomToken(auth, data.token);
}

interface PhoneVerifyFieldProps {
  phone: string;
  onPhoneChange: (phone: string) => void;
  verified: boolean;
  onVerified: (result: PhoneVerifyResult) => void;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  placeholder?: string;
}

/**
 * 휴대폰 번호 입력 + 문자 인증번호 확인.
 * 번호를 고치면 부모가 verified를 false로 돌려야 한다 (onPhoneChange에서 처리).
 */
export function PhoneVerifyField({ phone, onPhoneChange, verified, onVerified, inputClassName = 'kl-input', inputStyle, placeholder = "'-' 없이 숫자만 입력" }: PhoneVerifyFieldProps) {
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!codeSent || verified) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [codeSent, verified]);

  useEffect(() => {
    if (verified) { setCodeSent(false); setCode(''); }
  }, [verified]);

  // 안드로이드 크롬: 인증 문자가 오면 인증번호를 자동으로 채우고 확인 (WebOTP, 문자 끝의 '@도메인 #코드' 형식 필요)
  useEffect(() => {
    if (!codeSent || verified || typeof window === 'undefined' || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    (navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal } as CredentialRequestOptions) as Promise<(Credential & { code?: string }) | null>)
      .then(otp => {
        if (!otp?.code) return;
        setCode(otp.code);
        check(otp.code);
      })
      .catch(() => {}); // 사용자가 닫았거나 시간 초과
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeSent, verified, expiresAt]);

  const remain = Math.max(0, Math.floor((expiresAt - now) / 1000));

  const send = async () => {
    if (!isValidMobile(phone)) { toast.error('올바른 휴대폰 번호를 입력해 주세요.'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '인증번호를 보내지 못했어요.');
      setCodeSent(true);
      setCode(data.devCode || '');
      setExpiresAt(Date.now() + 3 * 60 * 1000);
      setNow(Date.now());
      toast.success(data.devCode ? `[개발용] 인증번호 ${data.devCode}` : '인증번호를 보냈어요.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const check = async (code: string) => {
    if (code.length !== 6) { toast.error('인증번호 6자리를 입력해 주세요.'); return; }
    setChecking(true);
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '인증에 실패했어요.');
      onVerified({ token: data.token, phone: data.phone, existing: data.existing || null });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChecking(false);
    }
  };

  const btn: CSSProperties = {
    flexShrink: 0, padding: '0 16px', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '0.85rem',
    background: '#111', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          className={inputClassName}
          style={{ ...inputStyle, flex: 1, minWidth: 0, ...(verified ? { background: '#F8F9FA', color: '#555' } : {}) }}
          type="tel"
          inputMode="numeric"
          placeholder={placeholder}
          value={phone}
          readOnly={verified}
          onChange={e => onPhoneChange(formatPhone(e.target.value))}
        />
        {verified ? (
          <button type="button" style={{ ...btn, background: '#F1F5F9', color: '#475569' }} onClick={() => onPhoneChange('')}>
            번호 변경
          </button>
        ) : (
          <button type="button" style={{ ...btn, opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={send}>
            {codeSent ? '재발송' : '인증번호 받기'}
          </button>
        )}
      </div>

      {codeSent && !verified && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
              className={inputClassName}
              style={{ ...inputStyle, width: '100%', paddingRight: '64px' }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="인증번호 6자리"
              value={code}
              maxLength={6}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', fontWeight: 700, color: remain > 0 ? '#FF6F61' : '#94A3B8' }}>
              {remain > 0 ? `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}` : '만료'}
            </span>
          </div>
          <button type="button" style={{ ...btn, background: '#FF6F61', opacity: checking ? 0.6 : 1 }} disabled={checking || remain === 0} onClick={() => check(code)}>
            확인
          </button>
        </div>
      )}

      {verified && (
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22C55E' }}>✓ 휴대폰 인증이 완료되었어요</div>
      )}
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)',
};
const card: CSSProperties = {
  background: '#fff', borderRadius: '28px', width: '100%', maxWidth: '400px', padding: '36px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};
const primaryBtn: CSSProperties = {
  display: 'block', width: '100%', padding: '15px', background: '#FF6F61', border: 'none', borderRadius: '100px', fontWeight: 800,
  fontSize: '0.95rem', color: '#fff', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginBottom: '10px', boxSizing: 'border-box',
};
const ghostBtn: CSSProperties = {
  width: '100%', padding: '12px', background: '#f8fafc', border: 'none', borderRadius: '100px', fontWeight: 600, fontSize: '0.85rem', color: '#888', cursor: 'pointer',
};

/**
 * 로그인한(카카오/구글로 막 가입한) 계정에서 인증한 번호로 기존 계정이 발견됐을 때.
 * 연결하면 지금 계정의 기록이 기존 계정으로 옮겨지고 기존 계정으로 다시 로그인된다.
 */
export function LinkAccountModal({ existing, token, onLinked, onClose }: {
  existing: ExistingAccount;
  token: string;
  onLinked: () => void;
  onClose: () => void;
}) {
  const [linking, setLinking] = useState(false);

  const link = async () => {
    setLinking(true);
    try {
      await linkToExistingAccount(token);
      toast.success('기존 계정에 연결했어요!');
      onLinked();
    } catch (err: any) {
      toast.error(err.message);
      setLinking(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <button onClick={onClose} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
          <X size={20} />
        </button>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', background: '#FFF0EE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: '1.8rem' }}>🔗</span>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#111', marginBottom: '10px' }}>예전에 가입한 계정이 있어요</h2>
          <p style={{ color: '#111', fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>{describeExisting(existing)}</p>
          <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: 1.7 }}>
            {existing.canLink
              ? <>지금 로그인한 계정을 기존 계정에 연결할게요.<br />지난 신청 내역·쿠폰·포인트를 그대로 쓸 수 있어요.</>
              : <>이 계정은 자동으로 연결할 수 없어요.<br />고객센터로 문의해 주세요.</>}
          </p>
        </div>
        {existing.canLink && (
          <button style={{ ...primaryBtn, opacity: linking ? 0.6 : 1 }} disabled={linking} onClick={link}>
            {linking ? '연결하는 중...' : '기존 계정에 연결하기'}
          </button>
        )}
        <button style={ghostBtn} onClick={onClose} disabled={linking}>취소</button>
      </div>
    </div>
  );
}

/** 로그인하지 않은 상태(아이디 회원가입 등)에서 인증한 번호로 기존 계정이 발견됐을 때: 그 방법으로 로그인하도록 안내. */
export function ExistingAccountModal({ existing, onClose }: { existing: ExistingAccount; onClose: () => void }) {
  return (
    <div style={overlay}>
      <div style={card}>
        <button onClick={onClose} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
          <X size={20} />
        </button>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', background: '#FFF0EE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: '1.8rem' }}>🔍</span>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#111', marginBottom: '10px' }}>이미 가입된 번호예요</h2>
          <p style={{ color: '#111', fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>{describeExisting(existing)}</p>
          <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: 1.7 }}>
            새로 가입하지 않고 기존 계정으로 로그인하면<br />지난 신청 내역·쿠폰·포인트를 그대로 쓸 수 있어요.
          </p>
        </div>
        <Link href="/login" style={primaryBtn}>{METHOD_LABEL[existing.method]}로 로그인하기</Link>
        {existing.method === 'id' && (
          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '10px' }}>아이디가 기억나지 않으면 로그인 화면의 [아이디 찾기]를 이용해 주세요.</p>
        )}
        <button style={ghostBtn} onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
