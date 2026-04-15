'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Heart, CheckCircle, Clock, ArrowRight, Lock, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// 더미 참가자 데이터 (실제론 Firestore에서 본인 참여 행사 기준으로 가져옴)
const mockParticipants = [
  { number: 1, nickname: '1번' },
  { number: 2, nickname: '2번' },
  { number: 3, nickname: '3번' },
  { number: 4, nickname: '4번' },
  { number: 5, nickname: '5번' },
  { number: 6, nickname: '6번' },
  { number: 7, nickname: '7번' },
];

export default function MatchingPage() {
  const [isLoggedIn] = useState(true); // 데모: 로그인 상태 가정
  const [hasParticipated] = useState(true); // 데모: 참여 여부 가정
  const [isOpen] = useState(true); // 순위 입력 오픈 여부 (관리자 제어)
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rankings, setRankings] = useState({ rank1: '', rank2: '', rank3: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rankings.rank1) { toast.error('1순위를 선택해주세요.'); return; }
    if (rankings.rank1 === rankings.rank2 || rankings.rank1 === rankings.rank3
      || (rankings.rank2 && rankings.rank2 === rankings.rank3)) {
      toast.error('같은 번호를 중복 선택할 수 없습니다.'); return;
    }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1800));
    setIsSubmitting(false);
    setSubmitted(true);
    toast.success('순위 입력이 완료되었습니다! 💌');
  };

  // 비로그인
  if (!isLoggedIn) {
    return (
      <NoticeScreen
        icon={<Lock size={40} color="#FF6F61" />}
        title="로그인이 필요합니다"
        desc="호감도 순위 입력은 참여자 전용 기능입니다."
        action={<Link href="/login" className="kl-btn-primary">로그인하기</Link>}
      />
    );
  }

  // 미참여자
  if (!hasParticipated) {
    return (
      <NoticeScreen
        icon={<Users size={40} color="#FF6F61" />}
        title="참여 내역이 없습니다"
        desc="금번 행사에 참여하신 회원만 접근할 수 있습니다."
        action={<Link href="/events" className="kl-btn-primary">일정 보러가기</Link>}
      />
    );
  }

  // 입력 미오픈
  if (!isOpen) {
    return (
      <NoticeScreen
        icon={<Clock size={40} color="#FF6F61" />}
        title="순위 입력 대기 중"
        desc="행사 종료 후 운영팀이 순위 입력을 오픈하면 입력하실 수 있습니다."
        action={null}
      />
    );
  }

  // 제출 완료
  if (submitted) {
    return (
      <div style={{ paddingTop: '90px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '90px 20px 60px' }}>
        <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div style={{
            width: '100px', height: '100px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,111,97,0.2), transparent)',
            border: '2px solid rgba(255,111,97,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
            animation: 'float 4s ease-in-out infinite',
          }}>
            <Heart size={44} color="var(--color-primary)" fill="rgba(255,111,97,0.3)" />
          </div>
          <h1 className="kl-heading-md" style={{ marginBottom: '16px' }}>
            순위 입력 <span className="kl-gradient-text">완료!</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '12px' }}>
            소중한 선택을 제출해 주셨습니다.<br/>
            운영팀이 매칭을 확정하면 알림을 보내드릴게요.
          </p>
          <div style={{
            padding: '10px 20px', borderRadius: '100px',
            background: 'rgba(255,111,97,0.1)', border: '1px solid rgba(255,111,97,0.2)',
            display: 'inline-block', marginBottom: '32px',
          }}>
            <span style={{ fontSize: '0.85rem', color: '#FF6F61', fontWeight: '700' }}>
              🕐 결과 확인까지 최대 24시간
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/matching/result" className="kl-btn-primary">매칭 결과 확인 <ArrowRight size={16} /></Link>
            <Link href="/" className="kl-btn-outline">홈으로</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh' }}>
      <section style={{
        padding: '60px 20px 40px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.1) 0%, transparent 70%)',
        borderBottom: '1px solid var(--color-border)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>RANKING INPUT</p>
        <h1 className="kl-heading-lg" style={{ marginBottom: '12px' }}>
          <span className="kl-gradient-text">호감도 순위 입력</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto' }}>
          오늘 대화한 분들 중 마음에 드신 분을 순위로 선택해 주세요.<br/>
          상호 호감이 일치하면 매칭됩니다!
        </p>
      </section>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 20px 80px' }}>
        {/* Info Banner */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.2)',
          borderRadius: 'var(--radius-md)', marginBottom: '32px',
          display: 'flex', gap: '12px', alignItems: 'flex-start',
        }}>
          <AlertCircle size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#FF6F61', marginBottom: '4px' }}>입력 안내</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              상대방 번호(테이블 번호)를 기준으로 선택하세요. 2, 3순위는 선택사항입니다. 제출 후 수정이 불가합니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[
            { key: 'rank1', label: '1순위 ❤️', required: true, desc: '가장 마음에 드신 분' },
            { key: 'rank2', label: '2순위 🧡', required: false, desc: '두 번째로 마음에 드신 분 (선택)' },
            { key: 'rank3', label: '3순위 💛', required: false, desc: '세 번째로 마음에 드신 분 (선택)' },
          ].map(({ key, label, required, desc }) => (
            <div key={key}>
              <label className="kl-label" style={{ fontSize: '1rem', color: '#111', fontWeight: '600', marginBottom: '6px' }}>{label}</label>
              <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '10px' }}>{desc}</p>
              <select
                className="kl-input"
                value={rankings[key as keyof typeof rankings]}
                onChange={(e) => setRankings(r => ({ ...r, [key]: e.target.value }))}
                required={required}
                style={{ background: '#fff', border: '1px solid #ccc', cursor: 'pointer', color: '#111' }}
              >
                <option value="">선택 안 함</option>
                {mockParticipants.map((p) => (
                  <option key={p.number} value={String(p.number)}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* Selected preview */}
          {(rankings.rank1 || rankings.rank2 || rankings.rank3) && (
            <div style={{
              padding: '20px',
              background: '#f9f9f9', border: '1px solid #ddd',
              borderRadius: 'var(--radius-md)',
            }}>
              <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#333', marginBottom: '12px' }}>선택 확인</p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {['rank1', 'rank2', 'rank3'].map((key, i) => {
                  const val = rankings[key as keyof typeof rankings];
                  if (!val) return null;
                  const colors = ['#E63946', '#6A4C93', '#2A9D8F'];
                  return (
                    <div key={key} style={{
                      padding: '8px 16px', borderRadius: '100px',
                      background: `rgba(${i === 0 ? '200,145,106' : i === 1 ? '169,143,213' : '110,174,124'},0.15)`,
                      border: `1px solid rgba(${i === 0 ? '200,145,106' : i === 1 ? '169,143,213' : '110,174,124'},0.3)`,
                    }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: colors[i] }}>
                        {i + 1}순위: {val}번
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{
            padding: '14px', borderRadius: 'var(--radius-md)',
            background: 'rgba(200,106,106,0.08)', border: '1px solid rgba(200,106,106,0.2)',
            display: 'flex', gap: '10px', alignItems: 'center',
          }}>
            <AlertCircle size={15} color="#C86A6A" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              제출 후 수정이 불가합니다. 신중하게 선택해 주세요.
            </p>
          </div>

          <button
            type="submit"
            className="kl-btn-primary"
            style={{ width: '100%', padding: '18px', fontSize: '1rem' }}
            disabled={isSubmitting || !rankings.rank1}
          >
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                제출 중...
              </span>
            ) : (
              <>💌 순위 제출하기</>
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function NoticeScreen({ icon, title, desc, action }: {
  icon: React.ReactNode; title: string; desc: string; action: React.ReactNode | null;
}) {
  return (
    <div style={{
      paddingTop: '90px', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '90px 20px 60px',
    }}>
      <div style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(255,111,97,0.1)', border: '1px solid rgba(255,111,97,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          {icon}
        </div>
        <h2 className="kl-heading-md" style={{ marginBottom: '14px' }}>{title}</h2>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '32px' }}>{desc}</p>
        {action}
      </div>
    </div>
  );
}
