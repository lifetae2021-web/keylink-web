'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { Loader2, Music, Upload, Trash2, ArrowUp, ArrowDown, Play, Pause } from 'lucide-react';

interface Track { id: string; title: string; url: string; theme: string; enabled: boolean; order: number; size: number; createdAt: number | null }
interface ThemeInfo { id: string; label: string }

const MAX = 4 * 1024 * 1024;

export default function PlazaBgmPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('all');
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const authed = async (url: string, init: RequestInit = {}) => {
    const t = await auth.currentUser?.getIdToken();
    return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + t } });
  };
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await authed('/api/admin/plaza/bgm');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '불러오기 실패');
      setTracks(j.tracks || []); setThemes(j.themes || []);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); return () => { audio.current?.pause(); }; }, [load]);

  const upload = async () => {
    if (!file) return;
    if (file.size > MAX) { setErr('4MB 이하 파일만 올릴 수 있어요(mp3 권장)'); return; }
    setBusy(true); setErr('');
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('title', title || file.name.replace(/\.[^.]+$/, '')); fd.append('theme', theme);
      const r = await authed('/api/admin/plaza/bgm', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error === 'too_big' ? '4MB 이하만 올릴 수 있어요' : j.error === 'bad_type' ? 'mp3·wav·ogg·m4a 파일만 올릴 수 있어요' : j.error || '올리기 실패');
      setFile(null); setTitle(''); say('올렸어요. 바로 재생 목록에 들어가요.'); await load();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setBusy(false); }
  };

  const patch = async (id: string, body: Partial<Track>) => {
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...body } : t)));
    await authed('/api/admin/plaza/bgm', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
  };
  const move = async (i: number, d: -1 | 1) => {
    const a = tracks[i], b = tracks[i + d]; if (!a || !b) return;
    const next = [...tracks]; next[i] = b; next[i + d] = a; setTracks(next);
    await Promise.all(next.map((t, k) => (t.order !== k + 1 ? patch(t.id, { order: k + 1 }) : null)));
  };
  const remove = async (t: Track) => {
    if (playing === t.id) { audio.current?.pause(); setPlaying(null); }
    setTracks((ts) => ts.filter((x) => x.id !== t.id));
    await authed('/api/admin/plaza/bgm?id=' + encodeURIComponent(t.id), { method: 'DELETE' });
    say('지웠어요');
  };
  const preview = (t: Track) => {
    if (playing === t.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause(); audio.current = new Audio(t.url); audio.current.volume = 0.6; audio.current.play().catch(() => {}); audio.current.onended = () => setPlaying(null); setPlaying(t.id);
  };

  const themeLabel = (id: string) => (id === 'all' ? '모든 테마' : themes.find((t) => t.id === id)?.label || id);
  const onCount = (id: string) => tracks.filter((t) => t.enabled && (t.theme === 'all' || t.theme === id)).length;
  const sel = { padding: '7px 9px', borderRadius: 9, border: '1px solid #e2e6ee', background: '#fff', fontSize: 13 } as const;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Music size={22} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>키링 월드 배경음악</h1>
      </div>
      <div style={{ fontSize: 13, color: '#67768b', marginTop: 8, lineHeight: 1.7, wordBreak: 'keep-all' }}>
        켠 곡은 위에서부터 차례로 계속 돌아가며 나와요. 한 곡만 켜 두면 그 곡만 반복돼요. 곡마다 어떤 테마에서 나올지 고를 수 있어요.
        {themes.length > 0 && <> 지금 켜진 곡: {themes.map((t) => `${t.label} ${onCount(t.id)}곡`).join(' · ')}</>}
      </div>
      {err && <div style={{ marginTop: 12, color: '#c0392b' }}>⚠️ {err}</div>}
      {msg && <div style={{ marginTop: 12, color: '#2e9e5b', fontWeight: 700 }}>{msg}</div>}

      <div style={{ marginTop: 16, border: '1px solid #e8ecf3', borderRadius: 14, background: '#fbfcfe', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <b style={{ fontSize: 14 }}>곡 올리기</b>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}>
          <span style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #c9d6ee', background: '#fff', color: '#3b6fd8', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>음악 파일 선택</span>
          <span style={{ fontSize: 13, color: file ? '#33415a' : '#9fb0c5', wordBreak: 'break-all' }}>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB` : '선택한 파일이 없어요'}</span>
          <input type="file" hidden accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/x-m4a,.mp3,.wav,.ogg,.m4a"
            onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '')); }} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="곡 이름" style={{ flex: '1 1 200px', minWidth: 0, padding: '9px 11px', borderRadius: 10, border: '1px solid #e2e6ee' }} />
          <select value={theme} onChange={(e) => setTheme(e.target.value)} style={sel}>
            <option value="all">모든 테마</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button onClick={upload} disabled={!file || busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: 'none', background: '#3b6fd8', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: !file || busy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            <Upload size={15} /> {busy ? '올리는 중…' : '올리기'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#8a98ab', wordBreak: 'keep-all' }}>mp3 권장 · 4MB 이하(128kbps 기준 약 4분). 저작권이 있는 음악은 사용 허락을 받은 곡만 올려 주세요.</div>
      </div>

      <div style={{ marginTop: 16, border: '1px solid #e8ecf3', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={18} /> 불러오는 중…</div>
        ) : tracks.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}>아직 올린 곡이 없어요.</div>
        ) : tracks.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid #f0f3f8', flexWrap: 'wrap', opacity: t.enabled ? 1 : 0.55 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 }}>
              <input type="checkbox" checked={t.enabled} onChange={(e) => patch(t.id, { enabled: e.target.checked })} /> {t.enabled ? '켜짐' : '꺼짐'}
            </label>
            <button onClick={() => preview(t)} title="미리 듣기" style={{ border: '1px solid #e2e6ee', background: '#fff', borderRadius: 9, padding: 6, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              {playing === t.id ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <input defaultValue={t.title} maxLength={40} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.title) patch(t.id, { title: v }); }}
              style={{ flex: '1 1 160px', minWidth: 0, padding: '7px 9px', borderRadius: 9, border: '1px solid transparent', background: '#f6f8fb', fontWeight: 600 }} />
            <select value={t.theme} onChange={(e) => patch(t.id, { theme: e.target.value })} style={sel}>
              <option value="all">모든 테마</option>
              {themes.map((th) => <option key={th.id} value={th.id}>{th.label}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#9fb0c5', whiteSpace: 'nowrap' }}>{(t.size / 1024 / 1024).toFixed(1)}MB</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => move(i, -1)} disabled={i === 0} title="위로" style={{ border: '1px solid #e2e6ee', background: '#fff', borderRadius: 8, padding: 5, cursor: 'pointer', opacity: i === 0 ? 0.4 : 1 }}><ArrowUp size={14} /></button>
              <button onClick={() => move(i, 1)} disabled={i === tracks.length - 1} title="아래로" style={{ border: '1px solid #e2e6ee', background: '#fff', borderRadius: 8, padding: 5, cursor: 'pointer', opacity: i === tracks.length - 1 ? 0.4 : 1 }}><ArrowDown size={14} /></button>
              <button onClick={() => remove(t)} title="지우기" style={{ border: '1px solid #e2e6ee', background: '#fff', color: '#c0392b', borderRadius: 8, padding: 5, cursor: 'pointer' }}><Trash2 size={14} /></button>
            </div>
            <span style={{ fontSize: 12, color: '#8a98ab', width: '100%', marginTop: -4 }}>{themeLabel(t.theme)}에서 재생</span>
          </div>
        ))}
      </div>
    </div>
  );
}
