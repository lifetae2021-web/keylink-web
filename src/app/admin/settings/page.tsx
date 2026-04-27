'use client';

import { useState } from 'react';
import { Save, Bell, Shield, Globe, Database, Key } from 'lucide-react';
import toast from 'react-hot-toast';

const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 };

const SECTIONS = [
  { key: 'general',  label: '일반 설정',    icon: Globe   },
  { key: 'notify',   label: '알림 설정',    icon: Bell    },
  { key: 'security', label: '보안 설정',    icon: Shield  },
  { key: 'system',   label: '시스템 정보',  icon: Database },
];

function InputRow({ label, defaultValue, type = 'text' }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#777', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        style={{
          width: '100%', padding: '9px 14px', fontSize: '0.85rem',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, color: '#ddd', outline: 'none',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,111,97,0.4)')}
        onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      />
    </div>
  );
}

function Toggle({ label, desc, defaultOn = false }: { label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</p>
        <p style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>{desc}</p>
      </div>
      <button
        onClick={() => setOn(v => !v)}
        className="relative transition-colors duration-200 rounded-full shrink-0"
        style={{ width: 44, height: 24, background: on ? '#FF6F61' : 'rgba(255,255,255,0.08)' }}
      >
        <span
          className="absolute top-1 rounded-full transition-all duration-200"
          style={{ width: 16, height: 16, background: '#fff', left: on ? 26 : 2 }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>시스템 설정</h2>
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
                  color:      activeSection === s.key ? '#FF6F61' : '#666',
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
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20 }}>서비스 기본 정보</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputRow label="서비스 이름"    defaultValue="키링크 (KEYLINK)" />
                  <InputRow label="대표 이메일"    defaultValue="keylink2025@gmail.com" type="email" />
                  <InputRow label="운영 지역"      defaultValue="부산, 창원" />
                  <InputRow label="공식 웹사이트"  defaultValue="https://www.keylink.kr" />
                </div>
              </div>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20 }}>행사 기본 설정</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputRow label="기본 참가비 (원)"        defaultValue="29000" />
                  <InputRow label="기본 정원 (남/여 각)"    defaultValue="8" />
                  <InputRow label="매칭 결과 공개 시간 (시)" defaultValue="21" />
                  <InputRow label="예약 마감 기준 (일 전)"   defaultValue="2" />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => toast.success('설정이 저장되었습니다.')}
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

          {activeSection === 'notify' && (
            <div style={{ ...panel, padding: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20 }}>알림 설정</h3>
              <Toggle label="신규 신청 알림"   desc="새로운 가입 신청이 들어오면 알림을 표시합니다."   defaultOn={true}  />
              <Toggle label="신원인증 요청 알림" desc="신원인증 요청이 접수되면 알림을 표시합니다."       defaultOn={true}  />
              <Toggle label="결제 완료 알림"   desc="결제가 완료되면 관리자 이메일로 알림을 보냅니다."   defaultOn={true}  />
              <Toggle label="매칭 결과 알림"   desc="매칭 연산 완료 후 결과 알림을 발송합니다."         defaultOn={false} />
              <Toggle label="행사 D-1 알림"   desc="행사 하루 전 참가자에게 자동 알림을 발송합니다."    defaultOn={true}  />
              <div className="flex justify-end mt-5">
                <button
                  onClick={() => toast.success('알림 설정이 저장되었습니다.')}
                  className="flex items-center gap-2 rounded-lg transition-colors"
                  style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600, background: '#FF6F61', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e85d50')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FF6F61')}
                >
                  <Save size={14} /> 저장
                </button>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20 }}>관리자 계정</h3>
                <div className="space-y-4">
                  <InputRow label="관리자 이메일" defaultValue="admin@keylink.kr" type="email" />
                  <InputRow label="현재 비밀번호"  defaultValue=""  type="password" />
                  <InputRow label="새 비밀번호"    defaultValue=""  type="password" />
                  <InputRow label="비밀번호 확인"  defaultValue=""  type="password" />
                </div>
              </div>
              <div style={{ ...panel, padding: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>보안 옵션</h3>
                <Toggle label="2단계 인증 (2FA)"    desc="로그인 시 추가 인증을 요구합니다."             defaultOn={false} />
                <Toggle label="IP 화이트리스트"     desc="지정된 IP에서만 관리자 접근을 허용합니다."       defaultOn={false} />
                <Toggle label="세션 자동 만료"      desc="30분 이상 비활성 시 자동으로 로그아웃합니다."    defaultOn={true}  />
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
            <div style={{ ...panel, padding: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20 }}>시스템 정보</h3>
              <div className="space-y-0">
                {[
                  { label: '프레임워크',   value: 'Next.js 14 (App Router)' },
                  { label: '데이터베이스', value: 'Firebase Firestore' },
                  { label: '인증',         value: 'Firebase Authentication' },
                  { label: '배포',         value: 'Vercel + keylink.kr' },
                  { label: '빌드 환경',    value: 'Node.js 20 LTS' },
                ].map(info => (
                  <div
                    key={info.label}
                    className="flex items-center justify-between py-3.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <span style={{ fontSize: '0.83rem', color: '#666' }}>{info.label}</span>
                    <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#ddd' }}>{info.value}</span>
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
          )}

        </div>
      </div>
    </div>
  );
}
