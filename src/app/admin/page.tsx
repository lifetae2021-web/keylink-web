'use client';
import { useState } from 'react';
import {
  Users, Calendar, Heart, TrendingUp, Play, CheckCircle,
  Lock, Unlock, Plus, Settings, BarChart3, RefreshCw,
  MapPin, Clock, AlertCircle, Edit, Trash2
} from 'lucide-react';
import { mockEvents } from '@/lib/mockData';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

const mockStats = {
  totalEvents: 120,
  totalParticipants: 1847,
  matchRate: 68,
  thisMonthRevenue: 3861000,
};

const mockParticipantList = [
  { num: 1, name: '김*준', gender: 'male', age: 28, job: '회사원', ranked: true },
  { num: 2, name: '이*연', gender: 'female', age: 26, job: '간호사', ranked: true },
  { num: 3, name: '박*호', gender: 'male', age: 30, job: '개발자', ranked: false },
  { num: 4, name: '최*아', gender: 'female', age: 27, job: '디자이너', ranked: true },
  { num: 5, name: '정*민', gender: 'male', age: 29, job: '교사', ranked: true },
  { num: 6, name: '오*진', gender: 'female', age: 25, job: '대학원생', ranked: false },
  { num: 7, name: '윤*현', gender: 'male', age: 31, job: '자영업', ranked: true },
  { num: 8, name: '한*서', gender: 'female', age: 28, job: '회사원', ranked: true },
];

const mockMatches = [
  { id: 'm1', user1: '김*준 (1번)', user2: '이*연 (2번)', type: '상호 1순위', status: 'confirmed' },
  { id: 'm2', user1: '박*호 (3번)', user2: '최*아 (4번)', type: '1순위 + 2순위', status: 'pending' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'participants' | 'matching'>('dashboard');
  const [rankingOpen, setRankingOpen] = useState(false);
  const [matchingPublished, setMatchingPublished] = useState(false);
  const [isRunningAlgo, setIsRunningAlgo] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(mockEvents[0].id);

  const handleRunAlgo = async () => {
    setIsRunningAlgo(true);
    await new Promise(r => setTimeout(r, 2500));
    setIsRunningAlgo(false);
    toast.success('✅ 매칭 알고리즘 실행 완료! 결과를 확인하세요.');
  };

  const handlePublishMatching = async () => {
    await new Promise(r => setTimeout(r, 800));
    setMatchingPublished(true);
    toast.success('🎉 매칭 결과가 참가자에게 공개되었습니다!');
  };

  const rankedCount = mockParticipantList.filter(p => p.ranked).length;

  return (
    <div style={{ paddingTop: '70px', minHeight: '100vh', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        padding: '24px 16px',
        position: 'fixed', top: '70px', left: 0, bottom: 0, overflowY: 'auto',
        zIndex: 50,
      }} className="admin-sidebar">
        <div style={{ marginBottom: '24px', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.15)' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '4px' }}>ADMIN</p>
          <p style={{ fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>키링크 관리자</p>
        </div>

        {[
          { key: 'dashboard', label: '대시보드', Icon: BarChart3 },
          { key: 'events', label: '행사 관리', Icon: Calendar },
          { key: 'participants', label: '참여자 관리', Icon: Users },
          { key: 'matching', label: '매칭 관리', Icon: Heart },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: activeTab === key ? 'rgba(255,111,97,0.15)' : 'transparent',
              border: activeTab === key ? '1px solid rgba(255,111,97,0.25)' : '1px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
              color: activeTab === key ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
              fontSize: '0.9rem', fontWeight: activeTab === key ? '600' : '400',
              marginBottom: '6px', transition: 'all 0.2s', textAlign: 'left',
            }}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: '240px', padding: '32px 28px', minHeight: '100vh' }} className="admin-main">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px' }}>대시보드</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '32px' }}>
              {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })} 현황
            </p>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {[
                { label: '총 진행 회차', value: `${mockStats.totalEvents}기`, icon: Calendar, color: 'var(--color-primary)' },
                { label: '총 누적 참여자', value: mockStats.totalParticipants.toLocaleString(), icon: Users, color: '#6A98C8' },
                { label: '매칭 성공률', value: `${mockStats.matchRate}%`, icon: Heart, color: '#6EAE7C' },
                { label: '이번 달 매출', value: `${(mockStats.thisMonthRevenue / 10000).toFixed(0)}만원`, icon: TrendingUp, color: '#E6E6FA' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{
                  background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)', padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{label}</p>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={color} />
                    </div>
                  </div>
                  <p style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-text-primary)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Recent events */}
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px' }}>최근 행사 현황</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mockEvents.slice(0, 3).map(ev => (
                <div key={ev.id} style={{
                  background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
                }}>
                  <div>
                    <p style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                      {ev.region === 'busan' ? '📍 부산' : '📍 창원'} {ev.episode}기
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                      {format(ev.date, 'M/d (E) HH:mm', { locale: ko })} · {ev.venue}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      남 {ev.currentMale}/{ev.maxMale} · 여 {ev.currentFemale}/{ev.maxFemale}
                    </span>
                    <span className={`kl-badge kl-badge-${ev.status === 'open' ? 'open' : 'upcoming'}`}>
                      {ev.status === 'open' ? '모집중' : '오픈예정'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>행사 관리</h1>
              <button className="kl-btn-primary" style={{ padding: '12px 20px', fontSize: '0.9rem' }}>
                <Plus size={17} /> 새 행사 등록
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mockEvents.map(ev => (
                <div key={ev.id} style={{
                  background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)', padding: '20px 24px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                          {ev.title} {ev.episode}기
                        </h3>
                        <span className={`kl-badge kl-badge-${ev.status === 'open' ? 'open' : 'upcoming'}`}>
                          {ev.status === 'open' ? '모집중' : '오픈예정'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={13} /> {format(ev.date, 'M월 d일 (E) HH:mm', { locale: ko })}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={13} /> {ev.venue}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Users size={13} /> 남 {ev.currentMale}/{ev.maxMale} · 여 {ev.currentFemale}/{ev.maxFemale}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                        <Edit size={15} />
                      </button>
                      <button onClick={() => toast.error('삭제는 신중히 진행해주세요.')}
                        style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(200,106,106,0.1)', border: '1px solid rgba(200,106,106,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C86A6A' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === 'participants' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>참여자 관리</h1>
              <select className="kl-input" style={{ width: 'auto', fontSize: '0.875rem' }} value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                {mockEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.region === 'busan' ? '부산' : '창원'} {ev.episode}기</option>
                ))}
              </select>
            </div>

            {/* Order control */}
            <div style={{
              padding: '16px 20px', marginBottom: '20px',
              background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.2)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} color="var(--color-primary)" />
                <div>
                  <p style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>순위 입력 현황</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{rankedCount}/{mockParticipantList.length}명 입력 완료</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: rankingOpen ? '#6EAE7C' : 'var(--color-text-muted)', fontWeight: '600' }}>
                  {rankingOpen ? '✅ 오픈됨' : '🔒 잠금'}
                </span>
                <button
                  onClick={() => { setRankingOpen(!rankingOpen); toast.success(rankingOpen ? '순위 입력이 잠겼습니다.' : '순위 입력이 오픈되었습니다!'); }}
                  style={{
                    padding: '10px 18px', borderRadius: 'var(--radius-md)',
                    background: rankingOpen ? 'rgba(200,106,106,0.15)' : 'rgba(110,174,124,0.15)',
                    border: `1px solid ${rankingOpen ? 'rgba(200,106,106,0.3)' : 'rgba(110,174,124,0.3)'}`,
                    color: rankingOpen ? '#C86A6A' : '#6EAE7C',
                    cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                  {rankingOpen ? <><Lock size={15} /> 입력 잠금</> : <><Unlock size={15} /> 입력 오픈</>}
                </button>
              </div>
            </div>

            {/* Participant list */}
            <div style={{ background: 'var(--gradient-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 1fr 1fr 100px', gap: '0', padding: '12px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                {['번호', '이름', '성별', '나이', '직업', '순위입력'].map(h => (
                  <span key={h} style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>
              {mockParticipantList.map((p, i) => (
                <div key={p.num} style={{
                  display: 'grid', gridTemplateColumns: '60px 1fr 80px 1fr 1fr 100px',
                  padding: '14px 20px', borderBottom: i < mockParticipantList.length - 1 ? '1px solid var(--color-border)' : 'none',
                  alignItems: 'center',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.9rem' }}>{p.num}번</span>
                  <span style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>{p.name}</span>
                  <span style={{ fontSize: '0.85rem', color: p.gender === 'male' ? '#6A98C8' : '#C878A0' }}>
                    {p.gender === 'male' ? '남' : '여'}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{p.age}세</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{p.job}</span>
                  <span>
                    {p.ranked
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#6EAE7C', fontWeight: '600' }}><CheckCircle size={14} /> 완료</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}><Clock size={14} /> 대기</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matching Tab */}
        {activeTab === 'matching' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px' }}>매칭 관리</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '32px' }}>
              순위 입력 완료 후 알고리즘을 실행하여 매칭을 확정하세요.
            </p>

            {/* Status card */}
            <div style={{
              padding: '24px', marginBottom: '24px',
              background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                    부산 102기 매칭 현황
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    순위 입력: {rankedCount}/{mockParticipantList.length}명 · 매칭 알고리즘 대기 중
                  </p>
                </div>
                {/* Progress bar */}
                <div style={{ minWidth: '200px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>입력 현황</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary-light)' }}>{Math.round(rankedCount/mockParticipantList.length*100)}%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${rankedCount/mockParticipantList.length*100}%`, background: 'linear-gradient(90deg, #FF6F61, #E6E6FA)', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>

              {/* Algo info */}
              <div style={{
                padding: '16px', borderRadius: 'var(--radius-md)',
                background: 'rgba(255,111,97,0.06)', border: '1px solid rgba(255,111,97,0.15)',
                marginBottom: '20px',
              }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-primary-light)', marginBottom: '8px' }}>📊 매칭 알고리즘 기준</p>
                {['상호 1순위인 경우 → 최우선 매칭', '1순위 + 상대의 2~3순위 → 차순위 매칭', '나머지 미매칭자 → 30% 환불 처리 안내'].map((r, i) => (
                  <p key={i} style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    {i + 1}. {r}
                  </p>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="kl-btn-primary"
                  onClick={handleRunAlgo}
                  disabled={isRunningAlgo || matchingPublished}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isRunningAlgo ? (
                    <><RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} /> 알고리즘 실행 중...</>
                  ) : (
                    <><Play size={17} /> 매칭 알고리즘 실행</>
                  )}
                </button>
                <button
                  onClick={handlePublishMatching}
                  disabled={matchingPublished}
                  style={{
                    padding: '14px 20px', borderRadius: 'var(--radius-md)',
                    background: matchingPublished ? 'rgba(110,174,124,0.2)' : 'rgba(110,174,124,0.15)',
                    border: `1px solid ${matchingPublished ? 'rgba(110,174,124,0.5)' : 'rgba(110,174,124,0.3)'}`,
                    color: '#6EAE7C', cursor: matchingPublished ? 'default' : 'pointer',
                    fontWeight: '600', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
                  }}>
                  <CheckCircle size={17} />
                  {matchingPublished ? '결과 공개됨 ✅' : '매칭 결과 공개'}
                </button>
              </div>
            </div>

            {/* Match results */}
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px' }}>매칭 결과 미리보기</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mockMatches.map(m => (
                <div key={m.id} style={{
                  padding: '16px 20px',
                  background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>{m.user1}</span>
                    <Heart size={16} color="#FF6F61" fill="rgba(255,111,97,0.4)" />
                    <span style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>{m.user2}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>{m.type}</span>
                    <span className={`kl-badge ${m.status === 'confirmed' ? 'kl-badge-open' : 'kl-badge-upcoming'}`}>
                      {m.status === 'confirmed' ? '확정' : '검토중'}
                    </span>
                  </div>
                </div>
              ))}
              {mockMatches.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  알고리즘을 실행하면 매칭 결과가 표시됩니다.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { width: 100% !important; position: static !important; height: auto !important; display: flex !important; flex-wrap: wrap !important; gap: 6px !important; padding: 12px !important; }
          .admin-main { margin-left: 0 !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
