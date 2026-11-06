'use client';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

// 홈 → 온라인 소개팅(3D 광장 /plaza) 진입 배너. 접속자 수는 광장 실시간 서버(Cloudflare)에서 가져온다.
const ROOMS_URL = 'https://keylink-plaza.keylink-plaza-cf.workers.dev/api/rooms';

// 지금 키링 월드 테마(관리자 > 키링 월드 > 테마)에 맞춰 그림·문구를 바꾼다
const COPY = {
  default: {
    img: '/plaza/preview_default.jpg', alt: '키링 월드 3D 화면 — 하늘섬 광장에서 저마다 꾸민 캐릭터들',
    badge: 'NEW · 신개념 온라인 소개팅', title: <>전국 어디서나 만나는 <span style={{ color: '#FF6F61' }}>키링 월드</span></>,
    desc: '키링크의 신개념 온라인 소개팅. 헤어·옷까지 내 취향대로 캐릭터를 꾸미고, 3D 하늘섬 광장을 걸어 다니며 마음에 드는 사람과 1:1 대화를 나눠 보세요. 숨은 황금 열쇠를 찾으면 포인트도 받고, 광장 동물들과 친해질 수도 있어요.',
    tags: ['전국 누구나', '1:1 대화', '로그인 없이 구경'], bg: 'linear-gradient(135deg, #bfe3ff 0%, #eaf7ff 55%, #ffe6ee 100%)',
  },
  xmas: {
    img: '/plaza/preview_xmas.jpg', alt: '크리스마스 키링 월드 — 소원 트리 앞에 모인 산타 모자 캐릭터들',
    badge: '크리스마스 키링 월드 오픈', title: <>눈 내리는 <span style={{ color: '#FF6F61' }}>키링 월드</span></>,
    desc: '올 크리스마스, 혼자 보내지 마세요. 산타 모자로 꾸민 내 캐릭터로 눈 덮인 키링 월드를 걷고, 소원 트리에 소원을 걸고, 마음에 드는 사람과 1:1 대화를 나눠 보세요. 숨은 선물 상자를 다 찾으면 포인트도 받아요.',
    tags: ['전국 누구나', '1:1 대화', '선물 찾기'], bg: 'linear-gradient(135deg, #d9d4ff 0%, #eef0ff 55%, #ffe3ec 100%)',
  },
} as const;

export function PlazaBanner() {
  const [online, setOnline] = useState(0);
  const [theme, setTheme] = useState<keyof typeof COPY>('default');
  const c = COPY[theme];

  useEffect(() => {
    let alive = true;
    const load = () => fetch(ROOMS_URL)
      .then((r) => r.json())
      .then((j: { rooms?: { count: number }[] }) => { if (alive) setOnline((j.rooms || []).reduce((s, r) => s + (r.count || 0), 0)); })
      .catch(() => { /* 접속자 수는 부가 정보 — 실패해도 배너는 그대로 */ });
    load();
    fetch('/api/plaza/theme').then((r) => r.json()).then((j: { theme?: string }) => { if (alive && j.theme && j.theme in COPY) setTheme(j.theme as keyof typeof COPY); }).catch(() => {});
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <section style={{ padding: '0 max(16px, env(safe-area-inset-left, 0px)) 24px' }}>
      <a href="/plaza" className="kl-plaza-banner" style={{ background: c.bg }}>
        {/* 실제 키링 월드 3D 화면(테마별 public/plaza/preview_*.jpg) */}
        <div className="kl-plaza-art">
          <img src={c.img} alt={c.alt} loading="lazy" width={1000} height={560} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ padding: '3px 10px', borderRadius: '100px', background: '#FF6F61', color: '#fff', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.04em' }}>{c.badge}</span>
            {online > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#2f7a4a', whiteSpace: 'nowrap' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3cc56b' }} />지금 {online}명 접속 중
              </span>
            )}
          </div>
          <h2 style={{ fontSize: 'clamp(1.15rem, 3vw, 1.45rem)', fontWeight: 900, color: '#2a3a55', marginBottom: '6px', wordBreak: 'keep-all', textWrap: 'balance' }}>
            {c.title}
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#4f5f78', lineHeight: 1.65, wordBreak: 'keep-all', marginBottom: '12px' }}>
            {c.desc}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {c.tags.map((t) => (
              <span key={t} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5b6f8c', background: 'rgba(255,255,255,0.7)', padding: '4px 10px', borderRadius: '100px', whiteSpace: 'nowrap' }}>{t}</span>
            ))}
            <span className="kl-plaza-go">키링 월드 입장하기 <ArrowRight size={16} /></span>
          </div>
        </div>
      </a>
      <style>{`
        .kl-plaza-banner { max-width: 900px; margin: 0 auto; display: flex; align-items: center; gap: 20px; padding: 22px 24px;
          border-radius: 24px; text-decoration: none; background: linear-gradient(135deg, #bfe3ff 0%, #eaf7ff 55%, #ffe6ee 100%);
          border: 1px solid rgba(140,170,210,0.45); box-shadow: 0 10px 30px rgba(80,130,190,0.15); transition: transform .2s ease, box-shadow .2s ease; }
        .kl-plaza-banner:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(80,130,190,0.22); }
        .kl-plaza-art { position: relative; flex: 0 0 240px; aspect-ratio: 1000 / 560; max-width: 100%; border-radius: 16px; overflow: hidden;
          background: #bfe3ff; box-shadow: 0 6px 18px rgba(60,110,170,0.18); border: 3px solid rgba(255,255,255,0.85); }
        .kl-plaza-art img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s ease; }
        .kl-plaza-banner:hover .kl-plaza-art img { transform: scale(1.04); }
        .kl-plaza-go { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; background: #FF6F61; color: #fff; font-weight: 900;
          font-size: 0.92rem; padding: 10px 18px; border-radius: 100px; white-space: nowrap; box-shadow: 0 6px 16px rgba(255,111,97,0.35); }
        @media (max-width: 560px) {
          .kl-plaza-banner { flex-direction: column; align-items: stretch; padding: 18px; gap: 14px; }
          .kl-plaza-art { flex-basis: auto; width: 100%; }
          .kl-plaza-go { margin-left: 0; width: 100%; justify-content: center; margin-top: 4px; }
        }
      `}</style>
    </section>
  );
}
