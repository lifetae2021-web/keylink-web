'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, MapPin, Users, ArrowLeft, AlertCircle,
  CheckCircle, Clock, Shield, ChevronDown, X
} from 'lucide-react';
import { mockEvents } from '@/lib/mockData';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const event = mockEvents.find((e) => e.id === id);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleAccepted, setRuleAccepted] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', gender: '', birthYear: '', job: '', phone: '', agreeTerms: false, agreeRule: false,
  });

  if (!event) {
    return (
      <div style={{ paddingTop: '90px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '3rem', marginBottom: '16px' }}>😢</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>행사를 찾을 수 없습니다.</p>
          <Link href="/events" className="kl-btn-primary" style={{ marginTop: '20px', display: 'inline-flex' }}>목록으로</Link>
        </div>
      </div>
    );
  }

  const soldOutM = event.currentMale >= event.maxMale;
  const soldOutF = event.currentFemale >= event.maxFemale;

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreeTerms || !form.agreeRule) {
      toast.error('약관 및 운영 규정에 동의해주세요.');
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsSubmitting(false);
    toast.success('🎉 예약이 완료되었습니다! 마이페이지에서 확인하세요.');
    router.push('/mypage');
  };

  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh' }}>
      {/* 영구제명 규정 팝업 */}
      {showRuleModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(200,106,106,0.4)',
            borderRadius: 'var(--radius-xl)',
            padding: '40px 32px',
            maxWidth: '480px', width: '100%',
            position: 'relative',
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(200,106,106,0.15)', border: '1px solid rgba(200,106,106,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <AlertCircle size={28} color="#C86A6A" />
            </div>
            <h2 style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: '800', color: '#C86A6A', marginBottom: '8px' }}>
              ⚠️ 중요 운영 규정
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '24px' }}>반드시 확인 후 동의해주세요</p>

            <div style={{
              background: 'rgba(200,106,106,0.08)', border: '1px solid rgba(200,106,106,0.2)',
              borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '24px',
            }}>
              {[
                '행사에서 얻은 타 참가자의 연락처, SNS 계정 등 개인정보를 무단으로 제3자에게 공유하는 행위',
                '매칭 결과와 무관하게 상대방에게 불쾌감을 주는 연락이나 접근',
                '허위 정보(나이, 직업, 결혼 여부)로 신청하는 행위',
                '행사 진행을 방해하는 일체의 행위',
              ].map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: i < 3 ? '12px' : 0 }}>
                  <span style={{ color: '#C86A6A', fontWeight: '700', flexShrink: 0 }}>{i + 1}.</span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{rule}</p>
                </div>
              ))}
            </div>
            <div style={{
              padding: '16px', borderRadius: 'var(--radius-md)',
              background: 'rgba(200,106,106,0.12)', border: '1px solid rgba(200,106,106,0.3)',
              textAlign: 'center', marginBottom: '24px',
            }}>
              <p style={{ fontWeight: '800', color: '#C86A6A', fontSize: '1rem' }}>위 행위 적발 시: 즉시 영구 제명</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>향후 모든 키링크 행사 참여 불가</p>
            </div>
            <button
              className="kl-btn-primary"
              style={{ width: '100%' }}
              onClick={() => { setRuleAccepted(true); setShowRuleModal(false); setForm(f => ({ ...f, agreeRule: true })); }}
            >
              확인하고 동의합니다
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>
        <Link href="/events" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: '32px', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> 일정 목록으로
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }} className="event-detail-grid">
          {/* Left */}
          <div>
            {/* Hero card */}
            <div style={{
              height: '260px',
              background: event.region === 'busan'
                ? 'linear-gradient(135deg, #FFF0F5, #FFE4E1)'
                : 'linear-gradient(135deg, #F8F8FF, #F0F0FF)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '28px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: event.region === 'busan'
                  ? 'radial-gradient(circle at 40% 50%, rgba(255,111,97,0.2), transparent 60%)'
                  : 'radial-gradient(circle at 40% 50%, rgba(169,143,213,0.2), transparent 60%)',
              }} />
              <div style={{ textAlign: 'center', position: 'relative' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.1em', color: event.region === 'busan' ? '#FF6F61' : '#A98FD5', textTransform: 'uppercase', marginBottom: '12px' }}>
                  {event.region === 'busan' ? 'BUSAN' : 'CHANGWON'}
                </p>
                <p style={{ fontSize: '4rem', fontWeight: '900', color: '#333333', lineHeight: 1 }}>
                  {event.episode}<span style={{ fontSize: '1.5rem' }}>기</span>
                </p>
                <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>{event.title}</p>
              </div>
            </div>

            {/* Description */}
            <div className="kl-card" style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '16px', color: 'var(--color-text-primary)' }}>행사 안내</h2>
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>{event.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                {[
                  { Icon: Calendar, label: '일시', value: format(event.date, 'M월 d일 (EEEE) HH:mm', { locale: ko }) },
                  { Icon: MapPin, label: '장소', value: event.venue },
                  { Icon: Users, label: '정원', value: `남 ${event.maxMale}명 · 여 ${event.maxFemale}명` },
                  { Icon: Clock, label: '1회 대화', value: '9분 30초' },
                ].map(({ Icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color="#FF6F61" />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{label}</p>
                      <p style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Policies */}
            <div className="kl-card">
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '20px', color: 'var(--color-text-primary)' }}>환불 & 보장 정책</h2>
              {[
                { icon: '💸', title: '중복 만남 100% 환불', desc: '이전 참가자와 재회 시 전액 환불', color: '#FF6F61' },
                { icon: '🔄', title: '미매칭 30% 환불', desc: '최종 매칭 미성사 시 부분 환불', color: '#A98FD5' },
                { icon: '💌', title: '매칭 성공 혜택', desc: '오픈채팅방으로 즉시 연결', color: '#6EAE7C' },
                { icon: '⚠️', title: '취소 정책', desc: '결제 후 개인 사유 취소 불가 (불가피한 경우 별도 문의)', color: '#C86A6A' },
              ].map((p) => (
                <div key={p.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{p.icon}</span>
                  <div>
                    <p style={{ fontWeight: '700', color: p.color, marginBottom: '2px', fontSize: '0.9rem' }}>{p.title}</p>
                    <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Booking Panel */}
          <div style={{ position: 'sticky', top: '90px', alignSelf: 'start' }}>
            <div className="kl-card">
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '20px', marginBottom: '20px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>참가비</p>
                <p style={{ fontSize: '2rem', fontWeight: '800', color: '#FF6F61' }}>
                  {event.price.toLocaleString()}원
                </p>
              </div>

              {/* Gender slots */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <div style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  background: soldOutM ? 'rgba(200,106,106,0.1)' : 'rgba(100,150,200,0.08)',
                  border: `1px solid ${soldOutM ? 'rgba(200,106,106,0.3)' : 'rgba(100,150,200,0.2)'}`,
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>남성 잔여</p>
                  <p style={{ fontWeight: '800', fontSize: '1.1rem', color: soldOutM ? '#C86A6A' : '#6A98C8' }}>
                    {soldOutM ? '마감' : `${event.maxMale - event.currentMale}석`}
                  </p>
                </div>
                <div style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  background: soldOutF ? 'rgba(200,106,106,0.1)' : 'rgba(200,120,160,0.08)',
                  border: `1px solid ${soldOutF ? 'rgba(200,106,106,0.3)' : 'rgba(200,120,160,0.2)'}`,
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>여성 잔여</p>
                  <p style={{ fontWeight: '800', fontSize: '1.1rem', color: soldOutF ? '#C86A6A' : '#C878A0' }}>
                    {soldOutF ? '마감' : `${event.maxFemale - event.currentFemale}석`}
                  </p>
                </div>
              </div>

              {!showBookingForm ? (
                <button
                  className="kl-btn-primary"
                  style={{ width: '100%', padding: '16px', fontSize: '1rem' }}
                  onClick={() => setShowBookingForm(true)}
                  disabled={soldOutM && soldOutF}
                >
                  {soldOutM && soldOutF ? '마감되었습니다' : '지금 신청하기'}
                </button>
              ) : (
                <form onSubmit={handleBooking}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label className="kl-label">이름</label>
                      <input className="kl-input" placeholder="실명 입력" required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="kl-label">성별</label>
                      <select className="kl-input" required value={form.gender} onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                        style={{ background: 'var(--color-surface-2)', color: form.gender ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        <option value="">선택하세요</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                    </div>
                    <div>
                      <label className="kl-label">출생연도</label>
                      <input className="kl-input" placeholder="예: 1997" type="number" min="1970" max="2005" required value={form.birthYear} onChange={(e) => setForm(f => ({ ...f, birthYear: e.target.value }))} />
                    </div>
                    <div>
                      <label className="kl-label">직업</label>
                      <input className="kl-input" placeholder="예: 간호사, 회사원, 대학원생" required value={form.job} onChange={(e) => setForm(f => ({ ...f, job: e.target.value }))} />
                    </div>
                    <div>
                      <label className="kl-label">연락처</label>
                      <input className="kl-input" placeholder="010-0000-0000" type="tel" required value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.agreeTerms} onChange={(e) => setForm(f => ({ ...f, agreeTerms: e.target.checked }))}
                          style={{ marginTop: '3px', accentColor: 'var(--color-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                          이용약관 및 개인정보처리방침에 동의합니다
                        </span>
                      </label>
                      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.agreeRule} onChange={(e) => { setForm(f => ({ ...f, agreeRule: e.target.checked })); if (e.target.checked && !ruleAccepted) setShowRuleModal(true); }}
                          style={{ marginTop: '3px', accentColor: '#C86A6A', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                          <span style={{ color: '#C86A6A', fontWeight: '700' }}>[필수] </span>
                          영구제명 규정을 확인하고 준수에 동의합니다
                          {!ruleAccepted && (
                            <button type="button" onClick={() => setShowRuleModal(true)} style={{ background: 'none', border: 'none', color: '#FF6F61', cursor: 'pointer', fontSize: '0.8rem', paddingLeft: '4px', fontWeight: '600', textDecoration: 'underline' }}>
                              내용 확인
                            </button>
                          )}
                        </span>
                      </label>
                    </div>

                    <button type="submit" className="kl-btn-primary" style={{ width: '100%', padding: '16px' }} disabled={isSubmitting}>
                      {isSubmitting ? '처리 중...' : '결제 및 예약 완료'}
                    </button>
                    <button type="button" onClick={() => setShowBookingForm(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '8px' }}>
                      취소
                    </button>
                  </div>
                </form>
              )}

              <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: 'rgba(255,111,97,0.06)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Shield size={14} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  개인정보는 행사 운영 목적으로만 사용되며 외부에 공유되지 않습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .event-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
