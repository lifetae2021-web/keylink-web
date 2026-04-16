'use client';
import { useState } from 'react';
import { ChevronDown, AlertCircle, Shield, HelpCircle, Megaphone } from 'lucide-react';

const faqs = [
  {
    q: '참가비는 얼마인가요?',
    a: '현재 부산 지역 1인 39,000원입니다. 결제 후 행사 당일 현장에서 신분증을 확인합니다.',
  },
  {
    q: '취소/환불이 가능한가요?',
    a: '행사 특성상 확정 이후 개인 사유(단순 변심, 일정 변경)로 인한 취소·환불은 원칙적으로 불가합니다. 단, 입원/직계가족 경조사 등 불가피한 사유는 증빙서류 제출 시 내부 검토 후 처리됩니다.',
  },
  {
    q: '혼자 참가해도 괜찮나요?',
    a: '네! 대부분의 참가자분들이 혼자 참가하십니다. 운영팀이 처음부터 끝까지 자리 안내, 분위기 조성을 도와드립니다.',
  },
  {
    q: '나이 제한이 있나요?',
    a: '만 20세 이상 성인만 참가 가능합니다. 신분증(주민등록증, 운전면허증)을 반드시 지참해 주세요.',
  },
  {
    q: '행사 장소는 어디인가요?',
    a: '부산은 해운대구 파티룸 모노리(Monory)를 주 장소로 사용합니다. 예약 확정 후 상세 주소를 안내드립니다.',
  },
  {
    q: '매칭 결과는 언제 알 수 있나요?',
    a: '행사 종료 후 웹사이트에서 순위를 입력하시면, 운영팀이 검토 후 최대 24시간 이내 매칭 결과를 공개합니다. 로그인 후 [매칭 결과] 페이지에서 확인하실 수 있습니다.',
  },
  {
    q: '중복 만남 환불 정책이 뭔가요?',
    a: '이전 키링크 행사에서 매칭된 상대방과 같은 행사에 참가하게 될 경우, 해당 행사 참가비 전액을 환불해 드립니다. 이는 키링크만의 차별화된 정책입니다.',
  },
  {
    q: '참가자 정보는 안전하게 보호되나요?',
    a: '모든 개인정보는 행사 운영 목적으로만 수집·사용되며 제3자에게 절대 공유되지 않습니다. 매칭 결과의 연락처는 매칭된 당사자에게만 공개됩니다.',
  },
  {
    q: '당일 몇 명이랑 대화하나요?',
    a: '행사당 최대 8명(남/여 각 8명)이 참가하며, 모든 이성과 9분 30초씩 1:1 대화를 나눕니다. 소규모이기 때문에 집중적이고 편안한 만남이 가능합니다.',
  },
  {
    q: '카카오로 로그인하면 어떤 정보를 가져오나요?',
    a: '카카오 로그인 시 닉네임과 이메일만 기본 수집합니다. 연락처, 직업 등 추가 프로필은 회원가입 단계에서 본인이 직접 입력하게 됩니다.',
  },
];

const notices = [
  {
    id: 1,
    title: '[중요] 2026년 5월 부산 행사 일정 안내',
    date: '2026-04-10',
    isImportant: true,
    content: '2026년 5월 부산 행사는 매주 토요일 오후 2시에 진행됩니다. 모노리 파티룸에서 진행되며 각 회차 8명 정원입니다.',
  },
  {
    id: 2,
    title: '[안내] 매칭 순위 입력 방법 변경 안내',
    date: '2026-04-01',
    isImportant: true,
    content: '이제 행사 종료 후 본 웹사이트에서 직접 순위를 입력하실 수 있습니다. QR 코드나 링크로도 접근 가능합니다.',
  },
  {
    id: 4,
    title: '연락처 무단 공유 관련 규정 강화 안내',
    date: '2026-03-01',
    isImportant: false,
    content: '타 참가자 연락처 무단 공유 시 즉시 영구 제명 조치됩니다. 안전한 만남 문화를 함께 만들어 주세요.',
  },
];

export default function NoticesPage() {
  const [activeTab, setActiveTab] = useState<'notice' | 'faq' | 'rules'>('notice');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openNotice, setOpenNotice] = useState<number | null>(null);

  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh' }}>
      {/* Header */}
      <section style={{
        padding: '60px 20px 0',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.08) 0%, transparent 70%)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>NOTICES & FAQ</p>
        <h1 className="kl-heading-lg" style={{ marginBottom: '32px' }}>
          <span className="kl-gradient-text">공지 & 도움말</span>
        </h1>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
          {[
            { key: 'notice', label: '📢 공지사항', Icon: Megaphone },
            { key: 'faq', label: '❓ FAQ', Icon: HelpCircle },
            { key: 'rules', label: '📋 이용 규정', Icon: Shield },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'notice' | 'faq' | 'rules')}
              style={{
                padding: '16px 32px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: '600',
                color: activeTab === key ? '#FF6F61' : 'var(--color-text-muted)',
                borderBottom: activeTab === key ? '2px solid #FF6F61' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="kl-section" style={{ maxWidth: '800px' }}>
        {/* 공지사항 */}
        {activeTab === 'notice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notices.map((n) => (
              <div
                key={n.id}
                style={{
                  background: 'var(--gradient-card)',
                  border: `1px solid ${n.isImportant ? 'rgba(255,111,97,0.3)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenNotice(openNotice === n.id ? null : n.id)}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '20px 24px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, textAlign: 'left', minWidth: 0 }}>
                    {n.isImportant && (
                      <span style={{
                        padding: '3px 10px', borderRadius: '100px', background: 'rgba(255,111,97,0.15)',
                        border: '1px solid rgba(255,111,97,0.3)', fontSize: '0.72rem', fontWeight: '800',
                        color: '#FF6F61', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>중요</span>
                    )}
                    <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{n.date}</span>
                    <ChevronDown size={18} color="var(--color-text-muted)"
                      style={{ transform: openNotice === n.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </div>
                </button>
                {openNotice === n.id && (
                  <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--color-border)' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, paddingTop: '16px' }}>{n.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* FAQ */}
        {activeTab === 'faq' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--gradient-card)',
                  border: `1px solid ${openFaq === i ? 'rgba(255,111,97,0.3)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '20px 24px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <span style={{ fontWeight: '800', color: '#FF6F61', fontSize: '1rem', flexShrink: 0 }}>Q</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{faq.q}</span>
                  </div>
                  <ChevronDown size={18} color="var(--color-text-muted)"
                    style={{ transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                  />
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', gap: '12px', paddingTop: '16px' }}>
                      <span style={{ fontWeight: '800', color: 'var(--color-accent)', fontSize: '1rem', flexShrink: 0 }}>A</span>
                      <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>{faq.a}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 이용 규정 */}
        {activeTab === 'rules' && (
          <div id="rules" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 영구제명 강조 박스 */}
            <div style={{
              padding: '28px',
              background: 'rgba(200,106,106,0.08)',
              border: '1.5px solid rgba(200,106,106,0.35)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(200,106,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertCircle size={22} color="#C86A6A" />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#B04A4A' }}>영구 제명 규정</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '16px' }}>
                아래 행위 적발 시 <strong style={{ color: '#C86A6A' }}>즉시 영구 제명</strong>되며, 향후 모든 키링크 행사 참여가 영구적으로 불가합니다.
              </p>
              {[
                '행사에서 획득한 타 참가자의 연락처, SNS 계정 등 개인정보를 제3자에게 무단 공유하는 행위',
                '매칭 결과와 무관하게 상대방에게 불쾌감을 주는 연락이나 접근',
                '나이, 직업, 결혼 여부 등 허위 정보로 신청하는 행위',
                '행사 진행을 방해하거나 타 참가자에게 해를 끼치는 일체의 행위',
                '만 20세 미만자의 신분 위조 참가',
              ].map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#C86A6A', fontWeight: '700', flexShrink: 0 }}>⚠</span>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{rule}</p>
                </div>
              ))}
            </div>

            {/* 환불 정책 */}
            {[
              {
                title: '결제 및 환불 정책',
                color: 'rgba(255,111,97,0.1)',
                borderColor: 'rgba(255,111,97,0.25)',
                items: [
                  '결제 완료 후 개인 사유(단순 변심, 일정 변경, 불참 등)로 인한 취소·환불 불가',
                  '중복 만남(이전 매칭자와 재회) 적발 시 참가비 전액 환불',
                  '최종 매칭 미성사 시 참가비의 30% 환불',
                  '서비스 제공자 귀책 사유로 행사가 미진행된 경우 전액 환불',
                  '입원/직계가족 경조사 등 불가피한 사유는 증빙서류 제출 시 내부 검토',
                ],
              },
              {
                title: '참가 자격 및 제한',
                color: 'rgba(110,174,124,0.08)',
                borderColor: 'rgba(110,174,124,0.2)',
                items: [
                  '만 20세 이상 성인만 참가 가능',
                  '행사 당일 신분증(주민등록증, 운전면허증) 지참 필수',
                  '허위 정보 기재 시 서비스 이용 즉시 제한 및 환불 불가',
                  '현재 결혼 중인 자는 참가 불가',
                  '인원 밸런스에 따라 신청이 반려될 수 있음',
                ],
              },
              {
                title: '개인정보 보호',
                color: 'rgba(169,143,213,0.08)',
                borderColor: 'rgba(169,143,213,0.2)',
                items: [
                  '수집 정보: 이름, 생년월일, 연락처, 직업, 행사 참여 정보',
                  '수집 목적: 참가 신청 확인, 매칭 진행, 행사 운영',
                  '보유 기간: 행사 종료 후 5년',
                  '매칭 결과의 연락처는 매칭된 당사자에게만 공개',
                  '개인정보 동의 거부 시 서비스 이용 제한될 수 있음',
                ],
              },
            ].map((section) => (
              <div key={section.title} style={{
                padding: '24px',
                background: section.color,
                border: `1px solid ${section.borderColor}`,
                borderRadius: 'var(--radius-lg)',
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={17} color="var(--color-primary)" /> {section.title}
                </h3>
                {section.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#FF6F61', fontWeight: '700', flexShrink: 0, fontSize: '0.8rem' }}>{i + 1}.</span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{item}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
