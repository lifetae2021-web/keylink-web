'use client';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

// 홈 → 온라인 소개팅(3D 광장 /plaza) 진입 배너. 접속자 수는 광장 실시간 서버(Cloudflare)에서 가져온다.
const ROOMS_URL = 'https://keylink-plaza.keylink-plaza-cf.workers.dev/api/rooms';

export function PlazaBanner() {
  const [online, setOnline] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => fetch(ROOMS_URL)
      .then((r) => r.json())
      .then((j: { rooms?: { count: number }[] }) => { if (alive) setOnline((j.rooms || []).reduce((s, r) => s + (r.count || 0), 0)); })
      .catch(() => { /* 접속자 수는 부가 정보 — 실패해도 배너는 그대로 */ });
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <section style={{ padding: '0 max(16px, env(safe-area-inset-left, 0px)) 24px' }}>
      <a href="/plaza" className="kl-plaza-banner">
        <div className="kl-plaza-art" aria-hidden>
          <span style={{ fontSize: '2.6rem' }}>🏡</span>
          <span style={{ fontSize: '1.7rem', position: 'absolute', left: '12px', bottom: '10px' }}>🧑</span>
          <span style={{ fontSize: '1.7rem', position: 'absolute', right: '14px', bottom: '12px' }}>👩</span>
          <span style={{ fontSize: '1.2rem', position: 'absolute', right: '10px', top: '10px' }}>🐶</span>
          <span style={{ fontSize: '1.1rem', position: 'absolute', left: '14px', top: '12px' }}>💬</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ padding: '3px 10px', borderRadius: '100px', background: '#FF6F61', color: '#fff', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.04em' }}>NEW · 온라인 소개팅</span>
            {online > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#2f7a4a', whiteSpace: 'nowrap' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3cc56b' }} />지금 {online}명 접속 중
              </span>
            )}
          </div>
          <h2 style={{ fontSize: 'clamp(1.15rem, 3vw, 1.45rem)', fontWeight: 900, color: '#2a3a55', marginBottom: '6px', wordBreak: 'keep-all', textWrap: 'balance' }}>
            집에서 만나는 <span style={{ color: '#FF6F61' }}>키링크 광장</span>
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#4f5f78', lineHeight: 1.65, wordBreak: 'keep-all', marginBottom: '12px' }}>
            내 캐릭터로 3D 광장을 걸어 다니며 1:1 대화를 나눠 보세요. AI 큐피드와 소개팅 대화 연습도 할 수 있어요.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {['설치 없이 바로', '로그인 없이 구경', 'AI 대화 연습'].map((t) => (
              <span key={t} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5b6f8c', background: 'rgba(255,255,255,0.7)', padding: '4px 10px', borderRadius: '100px', whiteSpace: 'nowrap' }}>{t}</span>
            ))}
            <span className="kl-plaza-go">광장 입장하기 <ArrowRight size={16} /></span>
          </div>
        </div>
      </a>
      <style>{`
        .kl-plaza-banner { max-width: 900px; margin: 0 auto; display: flex; align-items: center; gap: 20px; padding: 22px 24px;
          border-radius: 24px; text-decoration: none; background: linear-gradient(135deg, #bfe3ff 0%, #eaf7ff 55%, #ffe6ee 100%);
          border: 1px solid rgba(140,170,210,0.45); box-shadow: 0 10px 30px rgba(80,130,190,0.15); transition: transform .2s ease, box-shadow .2s ease; }
        .kl-plaza-banner:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(80,130,190,0.22); }
        .kl-plaza-art { position: relative; flex: 0 0 120px; height: 120px; border-radius: 20px; background: rgba(255,255,255,0.55);
          display: flex; align-items: center; justify-content: center; }
        .kl-plaza-go { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; background: #FF6F61; color: #fff; font-weight: 900;
          font-size: 0.92rem; padding: 10px 18px; border-radius: 100px; white-space: nowrap; box-shadow: 0 6px 16px rgba(255,111,97,0.35); }
        @media (max-width: 560px) {
          .kl-plaza-banner { flex-direction: column; align-items: stretch; padding: 18px; gap: 14px; }
          .kl-plaza-art { flex-basis: auto; height: 96px; }
          .kl-plaza-go { margin-left: 0; width: 100%; justify-content: center; margin-top: 4px; }
        }
      `}</style>
    </section>
  );
}
