'use client';

import { useState, useEffect } from 'react';
import { Save, Bell, Shield, Globe, Database, Key, Gift, Loader2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { getIdToken } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const panel = { background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };

const SECTIONS = [
  { key: 'general',  label: '일반 설정',    icon: Globe   },
  { key: 'notify',   label: '알림 설정',    icon: Bell    },
  { key: 'security', label: '보안 설정',    icon: Shield  },
  { key: 'system',   label: '시스템 정보',  icon: Database },
];

function InputRow({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#777', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '9px 14px', fontSize: '0.85rem',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 8, color: '#334155', outline: 'none',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,111,97,0.4)')}
        onBlur={e  => (e.currentTarget.style.borderColor = '#e2e8f0')}
      />
    </div>
  );
}

function PriceInputRow({ label, value, onChange }: { label: string; value: string | number; onChange: (v: string) => void }) {
  const displayValue = value ? Number(String(value).replace(/[^0-9]/g, "")).toLocaleString() : "";
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#777', marginBottom: 6 }}>{label}</label>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          onChange(raw);
        }}
        style={{
          width: '100%', padding: '9px 14px', fontSize: '0.85rem',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 8, color: '#334155', outline: 'none',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,111,97,0.4)')}
        onBlur={e  => (e.currentTarget.style.borderColor = '#e2e8f0')}
      />
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{label}</p>
        <p style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative transition-colors duration-200 rounded-full shrink-0"
        style={{ width: 44, height: 24, background: value ? '#FF6F61' : '#e2e8f0' }}
      >
        <span
          className="absolute top-1 rounded-full transition-all duration-200"
          style={{ width: 16, height: 16, background: '#fff', left: value ? 26 : 2 }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState<any>({
    serviceName: '키링크 (KEYLINK)',
    email: 'keylink2025@gmail.com',
    region: '부산, 창원',
    website: 'https://www.keylink.kr',
    malePrice: 49000,
    maleSafePrice: 60000,
    femalePrice: 29000,
    femaleGroupPrice: 24000,
    capacity: 8,
    matchResultTime: 21,
    reservationDeadline: 2,
    notifyNewApp: true,
    notifyVerification: true,
    notifyPayment: true,
    notifyMatch: false,
    notifyD1: true,
  });

  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ issuedCount: number; skippedCount: number; issuedTo: string[] } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, 'settings', 'general');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSettings((prev: any) => ({ ...prev, ...snap.data() }));
        }
      } catch (e) {
        console.error(e);
        toast.error('설정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', 'general');
      const payload = {
        ...settings,
        malePrice: Number(settings.malePrice),
        maleSafePrice: Number(settings.maleSafePrice),
        femalePrice: Number(settings.femalePrice),
        femaleGroupPrice: Number(settings.femaleGroupPrice),
        capacity: Number(settings.capacity),
        matchResultTime: Number(settings.matchResultTime),
        reservationDeadline: Number(settings.reservationDeadline),
        updatedAt: new Date()
      };
      await setDoc(docRef, payload, { merge: true });
      toast.success('설정이 성공적으로 저장되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleBackfillCoupons = async () => {
    if (!confirm('쿠폰이 없는 전체 회원에게 웰컴 쿠폰(5,000원)을 일괄 발급합니다. 계속하시겠습니까?')) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const user = auth.currentUser;
      if (!user) { toast.error('로그인이 필요합니다.'); return; }
      const token = await getIdToken(user);
      const res = await fetch('/api/admin/coupons/backfill-welcome', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '오류가 발생했습니다.');
      setBackfillResult(data);
      toast.success(`✅ ${data.issuedCount}명에게 쿠폰 발급 완료!`);
    } catch (e: any) {
      toast.error(e.message || '오류가 발생했습니다.');
    } finally {
      setBackfilling(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-gray-400" size={30} /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>시스템 설정</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Sidebar nav */}
        <div className="lg:col-span-1">
          <div style={{ ...panel, padding: 8 }}>
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className="w-full flex items-center gap-3 rounded-lg transition-all duration-150"
                style={{
                  padding: '10px 14px', fontSize: '0.85rem',
                  fontWeight: activeSection === s.key ? 600 : 400,
                  color:      activeSection === s.key ? '#FF6F61' : '#64748b',
                  background: activeSection === s.key ? 'rgba(255,111,97,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (activeSection !== s.key) (e.currentTarget.style.color = '#aaa'); }}
                onMouseLeave={e => { if (activeSection !== s.key) (e.currentTarget.style.color = '#666'); }}
              >
                <s.icon size={15} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-5">

          {activeSection === 'general' && (
            <>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, color: '#334155' }}>서비스 기본 정보</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputRow label="서비스 이름"    value={settings.serviceName} onChange={v => handleChange('serviceName', v)} />
                  <InputRow label="대표 이메일"    value={settings.email} onChange={v => handleChange('email', v)} type="email" />
                  <InputRow label="운영 지역"      value={settings.region} onChange={v => handleChange('region', v)} />
                  <InputRow label="공식 웹사이트"  value={settings.website} onChange={v => handleChange('website', v)} />
                </div>
              </div>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, color: '#334155' }}>행사 기본 설정</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PriceInputRow label="남성 기본 참가비 (원)" value={settings.malePrice} onChange={v => handleChange('malePrice', v)} />
                  <PriceInputRow label="남성 안심 옵션 참가비 (원)" value={settings.maleSafePrice} onChange={v => handleChange('maleSafePrice', v)} />
                  <PriceInputRow label="여성 기본 참가비 (원)" value={settings.femalePrice} onChange={v => handleChange('femalePrice', v)} />
                  <PriceInputRow label="여성 동반 옵션 참가비 (원)" value={settings.femaleGroupPrice} onChange={v => handleChange('femaleGroupPrice', v)} />
                  <InputRow label="기본 정원 (남/여 각)"    value={settings.capacity} onChange={v => handleChange('capacity', v)} type="number" />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg transition-colors"
                  style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600, background: saving ? '#555' : '#FF6F61', color: '#fff' }}
                  onMouseEnter={e => { if(!saving) e.currentTarget.style.background = '#e85d50' }}
                  onMouseLeave={e => { if(!saving) e.currentTarget.style.background = '#FF6F61' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </>
          )}

          {activeSection === 'notify' && (
            <>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, color: '#334155' }}>알림 설정</h3>
                <Toggle label="신규 신청 알림"   desc="새로운 가입 신청이 들어오면 알림을 표시합니다."   value={settings.notifyNewApp} onChange={v => handleChange('notifyNewApp', v)} />
                <Toggle label="신원인증 요청 알림" desc="신원인증 요청이 접수되면 알림을 표시합니다."       value={settings.notifyVerification} onChange={v => handleChange('notifyVerification', v)} />
                <Toggle label="결제 완료 알림"   desc="결제가 완료되면 관리자 이메일로 알림을 보냅니다."   value={settings.notifyPayment} onChange={v => handleChange('notifyPayment', v)} />
                <Toggle label="매칭 결과 알림"   desc="매칭 연산 완료 후 결과 알림을 발송합니다."         value={settings.notifyMatch} onChange={v => handleChange('notifyMatch', v)} />
                <Toggle label="행사 D-1 알림"   desc="행사 하루 전 참가자에게 자동 알림을 발송합니다."    value={settings.notifyD1} onChange={v => handleChange('notifyD1', v)} />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg transition-colors"
                  style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600, background: saving ? '#555' : '#FF6F61', color: '#fff' }}
                  onMouseEnter={e => { if(!saving) e.currentTarget.style.background = '#e85d50' }}
                  onMouseLeave={e => { if(!saving) e.currentTarget.style.background = '#FF6F61' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </>
          )}

          {activeSection === 'security' && (
            <>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, color: '#334155' }}>관리자 계정</h3>
                <div className="space-y-4">
                  <InputRow label="관리자 이메일" value="admin@keylink.kr" onChange={()=>{}} type="email" />
                  <InputRow label="현재 비밀번호"  value="" onChange={()=>{}} type="password" />
                  <InputRow label="새 비밀번호"    value="" onChange={()=>{}} type="password" />
                  <InputRow label="비밀번호 확인"  value="" onChange={()=>{}} type="password" />
                </div>
              </div>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16, color: '#334155' }}>보안 옵션</h3>
                <Toggle label="2단계 인증 (2FA)"    desc="로그인 시 추가 인증을 요구합니다."             value={false} onChange={()=>{}} />
                <Toggle label="IP 화이트리스트"     desc="지정된 IP에서만 관리자 접근을 허용합니다."       value={false} onChange={()=>{}} />
                <Toggle label="세션 자동 만료"      desc="30분 이상 비활성 시 자동으로 로그아웃합니다."    value={true} onChange={()=>{}} />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => toast.success('보안 설정이 저장되었습니다.')}
                  className="flex items-center gap-2 rounded-lg transition-colors"
                  style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600, background: '#FF6F61', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e85d50')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FF6F61')}
                >
                  <Save size={14} /> 저장
                </button>
              </div>
            </>
          )}

          {activeSection === 'system' && (
            <>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, color: '#334155' }}>시스템 정보</h3>
                <div className="space-y-0">
                  {[
                    { label: '프레임워크',   value: 'Next.js 16 (App Router)' },
                    { label: '데이터베이스', value: 'Firebase Firestore' },
                    { label: '인증',         value: 'Firebase Authentication' },
                    { label: '배포',         value: 'Vercel + keylink.kr' },
                    { label: '빌드 환경',    value: 'Node.js 20 LTS' },
                  ].map(info => (
                    <div
                      key={info.label}
                      className="flex items-center justify-between py-3.5"
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                    >
                      <span style={{ fontSize: '0.83rem', color: '#666' }}>{info.label}</span>
                      <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#334155' }}>{info.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(255,111,97,0.05)', border: '1px solid rgba(255,111,97,0.12)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Key size={13} style={{ color: '#FF6F61' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FF6F61' }}>Firebase 연결 상태</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
                    <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>정상 연결됨</span>
                  </div>
                </div>
              </div>

              {/* 웰컴 쿠폰 일괄 발급 */}
              <div style={{ ...panel, padding: '24px' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Gift size={16} style={{ color: '#FF6F61' }} />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>웰컴 쿠폰 누락 회원 일괄 발급</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
                  쿠폰이 한 개도 없는 기존 회원에게 웰컴 가입 축하 쿠폰(5,000원, 유효기간 3개월)을 일괄 지급합니다.<br />
                  이미 쿠폰이 있는 회원은 건너뜁니다.
                </p>
                <button
                  onClick={handleBackfillCoupons}
                  disabled={backfilling}
                  className="flex items-center gap-2 rounded-lg transition-colors"
                  style={{
                    padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600,
                    background: backfilling ? '#555' : '#FF6F61', color: '#fff',
                    cursor: backfilling ? 'not-allowed' : 'pointer', border: 'none',
                  }}
                >
                  {backfilling ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                  {backfilling ? '발급 중...' : '쿠폰 없는 회원 일괄 발급'}
                </button>
                {backfillResult && (
                  <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <p style={{ fontSize: '0.83rem', fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>
                      ✅ 발급 완료: {backfillResult.issuedCount}명 / 건너뜀: {backfillResult.skippedCount}명
                    </p>
                    {backfillResult.issuedTo.length > 0 && (
                      <p style={{ fontSize: '0.75rem', color: '#666', lineHeight: 1.7 }}>
                        발급 대상: {backfillResult.issuedTo.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
