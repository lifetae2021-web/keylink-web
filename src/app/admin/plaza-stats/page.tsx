'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { Loader2, RefreshCw, Activity, Search } from 'lucide-react';

interface Visit { id: number; room: string; nick: string; member: number; uid: string | null; enter_at: number; leave_at: number | null; online: boolean }
interface Stats {
  now: { total: number; rooms: Record<string, number> };
  todayPeak: number;
  best: { peak: number; at: number } | null;
  hourly: { t: number; peak: number }[];
  daily: { day: number; peak: number; entries: number; uniq: number; members: number; avgStayMs: number }[];
  visits: Visit[];
  retentionDays: number;
}

const BAR = '#3b6fd8';
const INK = '#1f2a3d', SUB = '#67768b', MUTED = '#9fb0c5', LINE = '#e8ecf3';
const pad = (n: number) => String(n).padStart(2, '0');
const dt = (ms: number) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const day = (ms: number) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`; };
const stay = (ms: number) => {
  if (!ms || ms < 0) return '-';
  const m = Math.round(ms / 60000);
  if (m < 1) return '1분 미만';
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
};

function Tile({ label, value, sub, live }: { label: string; value: string; sub?: string; live?: boolean }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 13, color: SUB, display: 'flex', alignItems: 'center', gap: 6 }}>
        {live && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2e9e5b' }} />}{label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: INK, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// 최근 24시간 시간대별 최고 동시접속 — 막대 하나 = 1시간, 마우스를 올리면 수치
function HourlyChart({ data }: { data: Stats['hourly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...data.map((d) => d.peak));
  const ticks = [0, Math.ceil(max / 2), max];
  const W = 720, H = 180, L = 28, B = 24, T = 10;
  const bw = (W - L) / data.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const h = hover !== null ? data[hover] : null;
  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 520, display: 'block' }} onMouseLeave={() => setHover(null)} role="img" aria-label="최근 24시간 시간대별 최고 동시접속">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke={LINE} strokeWidth={1} />
            <text x={L - 6} y={y(t) + 4} fontSize={11} fill={MUTED} textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + i * bw, top = y(d.peak), hgt = H - B - top;
          const hr = new Date(d.t).getHours();
          return (
            <g key={d.t} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={T} width={bw} height={H - T - B} fill="transparent" />
              {d.peak > 0 && (
                <path d={`M${x + 1},${H - B} V${top + Math.min(4, hgt)} q0,-4 4,-4 H${x + bw - 5} q4,0 4,4 V${H - B} Z`}
                  fill={BAR} opacity={hover === null || hover === i ? 1 : 0.45} />
              )}
              {hr % 3 === 0 && <text x={x + bw / 2} y={H - 7} fontSize={11} fill={MUTED} textAnchor="middle">{hr}시</text>}
            </g>
          );
        })}
      </svg>
      {h && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: INK, color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, pointerEvents: 'none' }}>
          {new Date(h.t).getHours()}시 대 · 최고 <b>{h.peak}명</b>
        </div>
      )}
    </div>
  );
}

export default function PlazaStatsPage() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [type, setType] = useState<'all' | 'member' | 'guest'>('all');
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setErr('');
    try {
      const t = await auth.currentUser?.getIdToken();
      const r = await fetch(`/api/admin/plaza/stats?type=${type}&q=${encodeURIComponent(qApplied)}`, { headers: { Authorization: 'Bearer ' + t } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '불러오기 실패');
      setData(j);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  }, [type, qApplied]);

  useEffect(() => { load(); }, [load]);
  // 지금 접속 수는 30초마다 자동 갱신
  useEffect(() => { const id = setInterval(() => load(true), 30000); return () => clearInterval(id); }, [load]);

  const today = data?.daily[0];
  const onlineNow = data?.visits.filter((v) => v.online) || [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', color: INK }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Activity size={22} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>키링 월드 현황</h1>
        <span style={{ fontSize: 13, color: MUTED }}>30초마다 자동 갱신 · 접속 기록 {data?.retentionDays ?? 30}일 보관</span>
        <button onClick={() => load()} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: `1px solid ${LINE}`, borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          <RefreshCw size={15} /> 새로고침
        </button>
      </div>

      {err && <div style={{ marginTop: 16, color: '#c0392b' }}>⚠️ {err}</div>}
      {loading && !data ? (
        <div style={{ padding: 40, textAlign: 'center', color: MUTED }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={18} /> 불러오는 중…</div>
      ) : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 18 }}>
            <Tile live label="지금 동시접속" value={`${data.now.total}명`} sub={onlineNow.length ? `회원 ${onlineNow.filter((v) => v.member).length} · 비회원 ${onlineNow.filter((v) => !v.member).length}` : '접속자 없음'} />
            <Tile label="오늘 최고 동시접속" value={`${data.todayPeak}명`} />
            <Tile label="역대 최고 동시접속" value={`${data.best?.peak ?? 0}명`} sub={data.best ? dt(data.best.at) : '기록 없음'} />
            <Tile label="오늘 방문자" value={`${today?.uniq ?? 0}명`} sub={`입장 ${today?.entries ?? 0}회 · 회원 ${today?.members ?? 0}명`} />
          </div>

          <section style={{ marginTop: 16, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 2 }}>최근 24시간 동시접속</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>시간대마다 가장 많았던 동시접속 인원</div>
            <HourlyChart data={data.hourly} />
          </section>

          <section style={{ marginTop: 16, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>일별 요약 (최근 14일)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: SUB, textAlign: 'right' }}>
                    {['날짜', '최고 동시접속', '방문자', '회원', '입장 횟수', '평균 머문 시간'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${LINE}`, fontWeight: 600, textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.day} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid #f3f5f9`, textAlign: 'left', whiteSpace: 'nowrap' }}>{day(d.day)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid #f3f5f9`, fontWeight: 700 }}>{d.peak}명</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid #f3f5f9` }}>{d.uniq}명</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid #f3f5f9` }}>{d.members}명</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid #f3f5f9` }}>{d.entries}회</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid #f3f5f9` }}>{stay(d.avgStayMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginTop: 16, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>접속 기록</div>
              <span style={{ fontSize: 12, color: MUTED }}>최신 300건</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['all', '전체'], ['member', '회원'], ['guest', '비회원']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setType(k)}
                    style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid ${LINE}`, background: type === k ? INK : '#fff', color: type === k ? '#fff' : '#33415a', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); setQApplied(q.trim()); }} style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${LINE}`, borderRadius: 9, padding: '0 8px' }}>
                  <Search size={14} color={MUTED} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임 검색" style={{ border: 'none', outline: 'none', padding: '7px 0', width: 120, fontSize: 14 }} />
                </form>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 620 }}>
                <thead>
                  <tr style={{ color: SUB, textAlign: 'left' }}>
                    {['입장', '닉네임', '구분', '머문 시간', '회원 ID'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${LINE}`, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.visits.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: MUTED }}>접속 기록이 없어요.</td></tr>
                  ) : data.visits.map((v) => (
                    <tr key={v.id}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f5f9', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dt(v.enter_at)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f5f9', fontWeight: 600, wordBreak: 'keep-all' }}>{v.nick || '-'}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f5f9' }}>
                        <span style={{ background: v.member ? '#e8f0ff' : '#f1f1f1', color: '#33415a', borderRadius: 6, padding: '2px 8px', fontSize: 12, whiteSpace: 'nowrap' }}>{v.member ? '회원' : '비회원'}</span>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f5f9', whiteSpace: 'nowrap' }}>
                        {v.online ? <span style={{ color: '#2e9e5b', fontWeight: 700 }}>● 접속 중</span> : v.leave_at ? stay(v.leave_at - v.enter_at) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f5f9', color: SUB, fontSize: 12 }}>{v.uid ? <code>{v.uid}</code> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
