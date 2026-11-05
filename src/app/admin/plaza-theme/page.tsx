'use client';

import { useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { Loader2, Palette, Check, ExternalLink } from 'lucide-react';

interface ThemeInfo { id: string; label: string; desc: string }

const ymd = (ms: number | null) => {
  if (!ms) return '';
  const d = new Date(ms + 9 * 3600e3);
  return d.toISOString().slice(0, 10);
};

export default function PlazaThemePage() {
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [current, setCurrent] = useState<{ theme: string; until: number | null } | null>(null);
  const [pick, setPick] = useState('default');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const authed = async (url: string, init: RequestInit = {}) => {
    const t = await auth.currentUser?.getIdToken();
    return fetch(url, { ...init, headers: { ...(init.headers || {}), 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } });
  };

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await authed('/api/admin/plaza/theme');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '불러오기 실패');
      setThemes(j.themes || []); setCurrent({ theme: j.theme, until: j.until }); setPick(j.theme); setUntil(ymd(j.until));
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await authed('/api/admin/plaza/theme', { method: 'POST', body: JSON.stringify({ theme: pick, until: pick === 'default' ? null : until || null }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || '저장 실패');
      setMsg(j.live ? '바꿨어요. 지금 접속 중인 사람 화면도 바로 바뀌어요.' : '바꿨어요. 새로 들어오는 사람부터 적용돼요.');
      await load();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setBusy(false); }
  };

  const expired = current?.until && Date.now() > current.until;
  const nowLabel = current ? (expired ? '기본' : themes.find((t) => t.id === current.theme)?.label || current.theme) : '';

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Palette size={22} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>키링 월드 테마</h1>
        {current && <span style={{ fontSize: 13, color: '#8a98ab' }}>지금: <b style={{ color: '#33415a' }}>{nowLabel}</b>{!expired && current.until ? ` · ${ymd(current.until)}까지` : ''}</span>}
      </div>
      <div style={{ fontSize: 13, color: '#67768b', marginTop: 8, lineHeight: 1.7, wordBreak: 'keep-all' }}>
        기본 광장 위에 테마 장식을 덧씌워요. 바꾸면 지금 접속 중인 사람 화면도 새로고침 없이 바뀌고, 종료일을 정하면 그날이 지나면 자동으로 기본으로 돌아가요.
      </div>
      {err && <div style={{ marginTop: 14, color: '#c0392b' }}>⚠️ {err}</div>}

      {!current ? (
        <div style={{ padding: 30, color: '#9fb0c5' }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={18} /> 불러오는 중…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 18 }}>
            {themes.map((t) => {
              const on = pick === t.id;
              return (
                <button key={t.id} onClick={() => setPick(t.id)}
                  style={{ textAlign: 'left', padding: 16, borderRadius: 14, border: on ? '2px solid #3b6fd8' : '1px solid #e2e6ee', background: on ? '#eef4ff' : '#fff', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 16 }}>{t.label}</b>
                    {on && <Check size={16} color="#3b6fd8" />}
                  </div>
                  <div style={{ fontSize: 13, color: '#67768b', marginTop: 6, wordBreak: 'keep-all' }}>{t.desc}</div>
                  <a href={`/plaza?room=preview&theme=${t.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 12, color: '#3b6fd8', whiteSpace: 'nowrap' }}>
                    <ExternalLink size={12} /> 미리보기
                  </a>
                </button>
              );
            })}
          </div>

          {pick !== 'default' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontSize: 14, flexWrap: 'wrap' }}>
              <span style={{ whiteSpace: 'nowrap' }}>종료일(선택)</span>
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e6ee' }} />
              <span style={{ fontSize: 12, color: '#8a98ab', wordBreak: 'keep-all' }}>비워 두면 직접 바꿀 때까지 계속</span>
            </label>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={save} disabled={busy}
              style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#3b6fd8', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {busy ? '적용 중…' : '이 테마로 바꾸기'}
            </button>
            {msg && <span style={{ fontSize: 13, color: '#2e9e5b', wordBreak: 'keep-all' }}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
