'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, Handshake, Copy, ExternalLink } from 'lucide-react';
import { getNotices, getFaqs, getContent, getPartners, NoticeItem, FaqItem, PartnerItem } from '@/lib/firestore/cms';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

function NoticesContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'notice' | 'faq' | 'rules' | 'partners'>('partners');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [openNotice, setOpenNotice] = useState<string | null>(null);
  const [noticesList, setNoticesList] = useState<NoticeItem[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [rules, setRules] = useState('');
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [couponPopup, setCouponPopup] = useState<PartnerItem | null>(null);
  const [detailPopup, setDetailPopup] = useState<PartnerItem | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, 'users', user.uid));
        if (uSnap.exists()) {
          const role = uSnap.data().role;
          if (role === 'admin' || role === 'super_admin') setIsAdmin(true);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getNotices().then(setNoticesList);
    getFaqs().then(setFaqs);
    getContent('rules').then(setRules);
    getPartners().then((fetchedPartners) => {
      const fixed = fetchedPartners.filter(p => !p.isRandom);
      const random = fetchedPartners.filter(p => p.isRandom);

      let shuffled = [...random];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      setPartners([...fixed, ...shuffled]);
    });
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['notice', 'faq', 'rules'].includes(tab)) {
      setActiveTab(tab as any);
      window.scrollTo(0, 0);
    }
  }, [searchParams]);

  const handleCouponClick = (partner: PartnerItem) => {
    if (partner.couponUrl) {
      window.open(partner.couponUrl, '_blank');
    } else if (partner.couponCode) {
      setCouponPopup(partner);
    } else {
      toast('준비중입니다.');
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success('쿠폰 코드가 복사되었습니다!');
    });
  };

  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh', paddingBottom: '60px' }}>

      {/* 쿠폰 코드 팝업 */}
      {couponPopup && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setCouponPopup(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: '24px', padding: '32px 28px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            {couponPopup.logoUrl && (
              <img src={couponPopup.logoUrl} alt={couponPopup.name} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '16px', margin: '0 auto 16px', display: 'block', border: '1px solid #f0f0f0' }} />
            )}
            <p style={{ fontSize: '0.78rem', fontWeight: '700', color: '#FF6F61', marginBottom: '4px', letterSpacing: '0.08em' }}>쿠폰 코드</p>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111', marginBottom: '20px' }}>{couponPopup.name}</h3>
            <div
              style={{ background: '#FFF5F4', border: '2px dashed #FF6F61', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', cursor: 'pointer' }}
              onClick={() => copyCouponCode(couponPopup.couponCode!)}
            >
              <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#FF6F61', letterSpacing: '0.12em', fontFamily: 'monospace' }}>{couponPopup.couponCode}</p>
              <p style={{ fontSize: '0.75rem', color: '#FF9A9E', fontWeight: '600', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Copy size={12} /> 클릭하면 코드가 복사됩니다
              </p>
            </div>
            <button
              onClick={() => setCouponPopup(null)}
              style={{ width: '100%', padding: '12px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 상세 설명문구 팝업 */}
      {detailPopup && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setDetailPopup(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: '24px', padding: '32px 28px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            {detailPopup.logoUrl && (
              <img src={detailPopup.logoUrl} alt={detailPopup.name} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '16px', margin: '0 auto 16px', display: 'block', border: '1px solid #f0f0f0' }} />
            )}
            <p style={{ fontSize: '0.78rem', fontWeight: '700', color: '#FF6F61', marginBottom: '4px', letterSpacing: '0.08em' }}>협업사 상세정보</p>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111', marginBottom: '20px' }}>{detailPopup.name}</h3>
            
            <div style={{ background: '#f8f9fa', borderRadius: '14px', padding: '20px', marginBottom: '20px', textAlign: 'left', maxHeight: '40vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{detailPopup.detailContent}</p>
            </div>
            
            <button
              onClick={() => setDetailPopup(null)}
              style={{ width: '100%', padding: '12px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <section style={{ padding: '60px 20px 0', background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.08) 0%, transparent 70%)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>NOTICES & LEGAL</p>
        <h1 className="kl-heading-lg" style={{ marginBottom: '32px' }}>
          <span className="kl-gradient-text">협업사 & 공지</span>
        </h1>

        {/* Tabs */}
        <div 
          style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--color-border)', 
            overflowX: 'auto', 
            flexWrap: 'nowrap', 
            WebkitOverflowScrolling: 'touch' 
          }}
          className="scrollbar-hide px-2 md:justify-center"
        >
          {[
            { key: 'partners', label: '🤝 협업사' },
            { key: 'notice', label: '📢 공지사항' },
            { key: 'faq', label: '❓ FAQ' },
            { key: 'rules', label: '📋 이용 규정' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              style={{
                flexShrink: 0,
                padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: '600',
                color: activeTab === key ? '#FF6F61' : 'var(--color-text-muted)',
                borderBottom: activeTab === key ? '2px solid #FF6F61' : '2px solid transparent',
                marginBottom: '-1px', transition: 'all 0.2s',
                whiteSpace: 'nowrap'
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
                  borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'all 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenNotice(openNotice === n.id ? null : n.id)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, textAlign: 'left', minWidth: 0 }}>
                    {n.isImportant && (
                      <span style={{ padding: '3px 10px', borderRadius: '100px', background: 'rgba(255,111,97,0.15)', border: '1px solid rgba(255,111,97,0.3)', fontSize: '0.72rem', fontWeight: '800', color: '#FF6F61', whiteSpace: 'nowrap', flexShrink: 0 }}>중요</span>
                    )}
                    <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{n.date}</span>
                    <ChevronDown size={18} color="var(--color-text-muted)" style={{ transform: openNotice === n.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
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

        {/* 협업사 (관리자 전용 — 그리드 카드 UI) */}
        {activeTab === 'partners' && isAdmin && (
          <div>
            {partners.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Handshake size={40} color="#FFD3CD" style={{ margin: '0 auto 16px', display: 'block' }} />
                <p style={{ color: '#CCC', fontWeight: '700', fontSize: '0.9rem' }}>등록된 협업사가 없습니다.</p>
                <p style={{ color: '#DDD', fontSize: '0.82rem', marginTop: '4px' }}>관리자 페이지 &gt; 콘텐츠 편집 &gt; 협업사에서 등록해주세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {partners.map(partner => (
                  <div
                    key={partner.id}
                    style={{
                      background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
                      borderRadius: '20px', overflow: 'hidden',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(255,111,97,0.12)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)'; }}
                  >
                    {/* 1:1 로고 이미지 */}
                    <div style={{ position: 'relative', paddingTop: '100%', background: '#f8f8f8', overflow: 'hidden' }}>
                      {partner.logoUrl ? (
                        <img src={partner.logoUrl} alt={partner.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🤝</div>
                      )}
                    </div>

                    {/* 정보 및 버튼 */}
                    <div style={{ padding: '14px 10px 16px' }}>
                      <p style={{ fontWeight: '900', fontSize: '0.95rem', color: 'var(--color-text-primary)', marginBottom: '4px' }}>{partner.name}</p>
                      {partner.description && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>{partner.description}</p>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleCouponClick(partner)}
                          style={{
                            flex: 1, padding: '10px 4px', borderRadius: '100px',
                            background: 'linear-gradient(135deg, #FFB347, #FF6F61)',
                            color: '#fff', fontWeight: '800', fontSize: '0.76rem',
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(255,111,97,0.3)', transition: 'opacity 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          {(partner.couponLabel || '쿠폰 받기').replace('🎁', '').trim()}
                        </button>
                        
                        <a
                          href={partner.detailUrl || '#'}
                          target={partner.detailUrl ? "_blank" : "_self"}
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!partner.detailUrl) {
                              e.preventDefault();
                              if (partner.detailContent) {
                                setDetailPopup(partner);
                              } else {
                                toast.error('등록된 링크가 없습니다.');
                              }
                            }
                          }}
                          style={{
                            flex: 1, padding: '10px 4px', borderRadius: '100px',
                            background: 'transparent',
                            color: 'var(--color-text-secondary)', fontWeight: '700', fontSize: '0.76rem',
                            border: '1.5px solid var(--color-border)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                            textDecoration: 'none', transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF6F61'; (e.currentTarget as HTMLElement).style.color = '#FF6F61'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; }}
                        >
                          {(partner.detailLabel || '자세히').replace('🔍', '').trim()} <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'border-color 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <span style={{ fontWeight: '800', color: '#FF6F61', fontSize: '1rem', flexShrink: 0 }}>Q</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{faq.q}</span>
                  </div>
                  <ChevronDown size={18} color="var(--color-text-muted)" style={{ transform: openFaq === faq.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
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
