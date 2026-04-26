'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, AlertCircle, Shield, HelpCircle, Megaphone } from 'lucide-react';
import { getNotices, getFaqs, getContent, NoticeItem, FaqItem } from '@/lib/firestore/cms';

function NoticesContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'notice' | 'faq' | 'rules' | 'terms' | 'privacy'>('notice');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [openNotice, setOpenNotice] = useState<string | null>(null);
  const [noticesList, setNoticesList] = useState<NoticeItem[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [rules, setRules] = useState('');
  const [terms, setTerms] = useState('');
  const [privacy, setPrivacy] = useState('');

  useEffect(() => {
    getNotices().then(setNoticesList);
    getFaqs().then(setFaqs);
    getContent('rules').then(setRules);
    getContent('terms').then(setTerms);
    getContent('privacy').then(setPrivacy);
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['notice', 'faq', 'rules', 'terms', 'privacy'].includes(tab)) {
      setActiveTab(tab as any);
      window.scrollTo(0, 0);
    }
  }, [searchParams]);


  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh', paddingBottom: '60px' }}>
      {/* Header */}
      <section style={{
        padding: '60px 20px 0',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.08) 0%, transparent 70%)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>NOTICES & LEGAL</p>
        <h1 className="kl-heading-lg" style={{ marginBottom: '32px' }}>
          <span className="kl-gradient-text">공지 & FAQ</span>
        </h1>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { key: 'notice', label: '📢 공지사항' },
            { key: 'faq', label: '❓ FAQ' },
            { key: 'rules', label: '📋 이용 규정' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              style={{
                padding: '16px 20px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: '600',
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

      <section className="kl-section" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        {/* 공지사항 */}
        {activeTab === 'notice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {noticesList.map((n) => (
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
            {faqs.map((faq) => (
              <div
                key={faq.id}
                style={{
                  background: 'var(--gradient-card)',
                  border: `1px solid ${openFaq === faq.id ? 'rgba(255,111,97,0.3)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
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
                    style={{ transform: openFaq === faq.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                  />
                </button>
                {openFaq === faq.id && (
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
          <div id="rules" style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, background: 'var(--gradient-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '28px' }}>
            {rules || '이용 규정이 아직 등록되지 않았습니다.'}
          </div>
        )}

        {/* 이용약관 */}
        {activeTab === 'terms' && (
          <div id="terms" style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, background: 'var(--gradient-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '28px' }}>
            {terms || '이용약관이 아직 등록되지 않았습니다.'}
          </div>
        )}

        {/* 개인정보처리방침 */}
        {activeTab === 'privacy' && (
          <div id="privacy" style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, background: 'var(--gradient-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '28px' }}>
            {privacy || '개인정보처리방침이 아직 등록되지 않았습니다.'}
          </div>
        )}
      </section>
    </div>
  );
}

export default function NoticesPage() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <NoticesContent />
    </Suspense>
  );
}
