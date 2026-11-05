'use client';

import { useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { Loader2, RefreshCw, HelpCircle, Send, X, Trash2, BookOpen } from 'lucide-react';

interface Question {
  id: string; nick: string | null; guest: boolean; summary: string; question: string; kikiReply: string;
  context: { who: 'npc' | 'user'; text: string }[]; status: 'open' | 'answered' | 'dismissed';
  answer: string; taught: boolean; createdAt: number | null; answeredAt: number | null;
}
interface Faq { id: string; q: string; a: string; createdAt: number | null }

const fmt = (ms: number | null) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const btn = (bg: string, fg = '#fff') => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: bg === '#fff' ? '1px solid #e2e6ee' : 'none', background: bg, color: fg, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const });

export default function PlazaKikiPage() {
  const [rows, setRows] = useState<Question[]>([]);
  const [faq, setFaq] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'open' | 'all' | 'faq'>('open');
  const [sel, setSel] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [teachQ, setTeachQ] = useState('');
  const [teach, setTeach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');

  const authed = async (url: string, init: RequestInit = {}) => {
    const t = await auth.currentUser?.getIdToken();
    return fetch(url, { ...init, headers: { ...(init.headers || {}), 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } });
  };
  const say = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await authed('/api/admin/plaza/kiki');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '불러오기 실패');
      setRows(j.questions || []); setFaq(j.faq || []);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (q: Question) => { setSel(q); setAnswer(q.answer || ''); setTeachQ(q.summary || q.question); setTeach(!q.taught); };

  const submit = async () => {
    if (!sel || !answer.trim()) return;
    setBusy(true);
    try {
      const r = await authed('/api/admin/plaza/kiki', { method: 'POST', body: JSON.stringify({ id: sel.id, answer, teach, q: teachQ }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return say('저장 실패: ' + (j.error || r.status));
      say(j.delivered ? '키키가 대화방에 답을 전했어요' : '답을 저장했어요');
      await load(); setSel(null);
    } finally { setBusy(false); }
  };
  const dismiss = async (q: Question) => {
    await authed('/api/admin/plaza/kiki?id=' + encodeURIComponent(q.id), { method: 'DELETE' });
    setRows((rs) => rs.map((x) => (x.id === q.id ? { ...x, status: 'dismissed' } : x))); setSel(null);
  };
  const delFaq = async (f: Faq) => {
    await authed('/api/admin/plaza/kiki?faq=' + encodeURIComponent(f.id), { method: 'DELETE' });
    setFaq((fs) => fs.filter((x) => x.id !== f.id));
  };
  const addFaq = async () => {
    if (!newQ.trim() || !newA.trim()) return;
    const r = await authed('/api/admin/plaza/kiki', { method: 'POST', body: JSON.stringify({ faq: { q: newQ, a: newA } }) });
    if (r.ok) { setNewQ(''); setNewA(''); say('키키에게 알려 줬어요'); load(); }
  };

  const openCount = rows.filter((r) => r.status === 'open').length;
  const shown = rows.filter((r) => tab === 'all' || r.status === 'open');
  const statusLabel = (s: Question['status']) => (s === 'answered' ? '답함' : s === 'dismissed' ? '넘김' : '');

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <HelpCircle size={22} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>키키 질문</h1>
        <span style={{ fontSize: 13, color: '#8a98ab' }}>답할 질문 {openCount}건</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['open', '답할 질문'], ['all', '전체'], ['faq', '키키가 아는 답']] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setSel(null); }}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e6ee', background: tab === k ? '#1f2a3d' : '#fff', color: tab === k ? '#fff' : '#33415a', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
          <button onClick={load} style={btn('#fff', '#33415a')}><RefreshCw size={15} /> 새로고침</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#67768b', marginTop: 8, lineHeight: 1.7, wordBreak: 'keep-all' }}>
        키키가 확실히 모르는 질문이나 운영진에게 전해 달라는 요청이 여기로 와요. 답하면 키키가 그 사람의 대화방에 답을 전하고, &quot;키키에게도 알려 주기&quot;를 켜면 다음부터 다른 사람에게도 키키가 직접 답해요.
      </div>
      {err && <div style={{ marginTop: 16, color: '#c0392b' }}>⚠️ {err}</div>}
      {notice && <div style={{ marginTop: 12, color: '#2e9e5b', fontWeight: 700 }}>{notice}</div>}

      {tab === 'faq' ? (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ border: '1px solid #e8ecf3', borderRadius: 14, background: '#fbfcfe', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontSize: 14 }}>직접 알려 주기</b>
            <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="질문 (예: 주차할 곳이 있나요?)" maxLength={200}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e6ee' }} />
            <textarea value={newA} onChange={(e) => setNewA(e.target.value)} placeholder="키키가 할 답" maxLength={600} rows={3}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e6ee', resize: 'vertical' }} />
            <div><button onClick={addFaq} style={btn('#3b6fd8')}><BookOpen size={15} /> 키키에게 알려 주기</button></div>
          </div>
          {faq.length === 0 ? <div style={{ color: '#9fb0c5', padding: 16 }}>아직 알려 준 답이 없어요.</div> : faq.map((f) => (
            <div key={f.id} style={{ border: '1px solid #e8ecf3', borderRadius: 14, background: '#fff', padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, wordBreak: 'keep-all' }}>Q. {f.q}</div>
                <div style={{ marginTop: 6, color: '#33415a', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>A. {f.a}</div>
              </div>
              <button onClick={() => delFaq(f)} title="지우기" style={{ ...btn('#fff', '#c0392b'), padding: '6px 10px' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="kiki-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 380px) 1fr', gap: 16, marginTop: 18, alignItems: 'start' }}>
          <div style={{ border: '1px solid #e8ecf3', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={18} /> 불러오는 중…</div>
            ) : shown.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}>{tab === 'open' ? '답할 질문이 없어요.' : '질문이 없어요.'}</div>
            ) : shown.map((q) => (
              <button key={q.id} onClick={() => open(q)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid #f0f3f8', background: sel?.id === q.id ? '#eef4ff' : '#fff', cursor: 'pointer', opacity: q.status === 'open' ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontSize: 14, wordBreak: 'keep-all' }}>{q.summary || q.question}</b>
                  <span style={{ fontSize: 12, color: '#9fb0c5', flex: '0 0 auto' }}>{fmt(q.createdAt)}</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 4, color: '#67768b', display: 'flex', gap: 6 }}>
                  <span>{q.nick || '(닉네임 없음)'}{q.guest ? ' · 비회원' : ''}</span>
                  {statusLabel(q.status) && <span style={{ color: q.status === 'answered' ? '#2e9e5b' : '#9fb0c5' }}>{statusLabel(q.status)}</span>}
                </div>
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid #e8ecf3', borderRadius: 14, background: '#fbfcfe', minHeight: 320, padding: 16 }}>
            {!sel ? (
              <div style={{ color: '#9fb0c5', textAlign: 'center', paddingTop: 100 }}>왼쪽에서 질문을 선택하세요.</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 16, wordBreak: 'keep-all' }}>{sel.summary || sel.question}</b>
                  <span style={{ fontSize: 12, color: '#9fb0c5' }}>{sel.nick || '-'}{sel.guest ? ' · 비회원' : ''} · {fmt(sel.createdAt)}</span>
                </div>

                <div style={{ fontWeight: 800, margin: '14px 0 8px', fontSize: 14 }}>대화 흐름</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...sel.context, { who: 'user' as const, text: sel.question }, { who: 'npc' as const, text: sel.kikiReply }].map((m, i) => (
                    <div key={i} style={{ maxWidth: '82%', alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start', padding: '8px 12px', borderRadius: 12, background: m.who === 'user' ? '#dbe9ff' : '#fff', border: '1px solid #e8ecf3', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {m.text}
                    </div>
                  ))}
                </div>

                <div style={{ fontWeight: 800, margin: '16px 0 8px', fontSize: 14 }}>{sel.status === 'answered' ? '보낸 답' : '답하기'}</div>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={sel.status === 'answered'} maxLength={600} rows={4}
                  placeholder="키키가 이 사람에게 전할 답을 적어 주세요"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e6ee', resize: 'vertical', boxSizing: 'border-box' }} />
                {sel.status !== 'answered' && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, cursor: 'pointer', wordBreak: 'keep-all' }}>
                      <input type="checkbox" checked={teach} onChange={(e) => setTeach(e.target.checked)} />
                      키키에게도 알려 주기(다음부터 다른 사람에게도 직접 답해요)
                    </label>
                    {teach && (
                      <input value={teachQ} onChange={(e) => setTeachQ(e.target.value)} maxLength={200} placeholder="키키가 기억할 질문"
                        style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e6ee', boxSizing: 'border-box' }} />
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button disabled={busy || !answer.trim()} onClick={submit} style={{ ...btn('#3b6fd8'), opacity: busy || !answer.trim() ? 0.6 : 1 }}><Send size={15} /> 답 보내기</button>
                      {sel.status === 'open' && <button onClick={() => dismiss(sel)} style={btn('#fff', '#33415a')}><X size={15} /> 답 없이 넘기기</button>}
                    </div>
                  </>
                )}
                {sel.status === 'answered' && sel.taught && <div style={{ marginTop: 8, fontSize: 13, color: '#2e9e5b' }}>키키에게도 알려 준 답이에요.</div>}
              </>
            )}
          </div>
        </div>
      )}
      <style>{`@media (max-width: 760px){ .kiki-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
