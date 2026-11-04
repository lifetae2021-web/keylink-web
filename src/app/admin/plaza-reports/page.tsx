'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { Loader2, RefreshCw, Bell, CheckCircle2, RotateCcw, Ban } from 'lucide-react';

interface Report {
  id: string; reporter: string; reporterNick: string; targetUid: string | null; targetKey: string | null;
  targetType: 'member' | 'guest'; tid: string | null;
  targetNick: string; reason: string; detail: string; convId: string | null; status: 'open' | 'resolved'; createdAt: number | null;
}
interface Msg { id: string; from: string; text: string; at: number | null }

const fmt = (ms: number | null) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function PlazaReportsPage() {
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [sel, setSel] = useState<Report | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [ban, setBan] = useState<{ known: boolean; bannedUntil: number } | null>(null);
  const [banBusy, setBanBusy] = useState(false);

  const authed = async (url: string, init: RequestInit = {}) => {
    const t = await auth.currentUser?.getIdToken();
    return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + t } });
  };

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await authed('/api/admin/plaza/reports');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '불러오기 실패');
      setRows(j.reports || []);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadBan = async (rep: Report) => {
    setBan(null);
    if (!rep.tid) return;
    const r = await authed('/api/admin/plaza/ban', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tids: [rep.tid] }) });
    const j = await r.json().catch(() => ({}));
    setBan(j.status?.[rep.tid] || { known: false, bannedUntil: 0 });
  };
  const doBan = async (rep: Report, hours: number) => {
    if (!rep.tid) return;
    setBanBusy(true);
    try {
      const r = await authed('/api/admin/plaza/ban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tid: rep.tid, hours }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) alertMsg(j.error === 'unknown_target' ? '최근 7일 안에 접속 기록이 없어 차단할 수 없어요' : '차단 실패: ' + (j.error || r.status));
      await loadBan(rep);
    } finally { setBanBusy(false); }
  };
  const doUnban = async (rep: Report) => {
    if (!rep.tid) return;
    setBanBusy(true);
    try { await authed('/api/admin/plaza/ban?tid=' + encodeURIComponent(rep.tid), { method: 'DELETE' }); await loadBan(rep); }
    finally { setBanBusy(false); }
  };
  const [notice, setNotice] = useState('');
  const alertMsg = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 4000); };

  const open = async (rep: Report) => {
    setSel(rep); setMsgs([]); loadBan(rep);
    if (!rep.convId) return;
    setMsgLoading(true);
    try {
      const r = await authed('/api/admin/plaza/chats/' + encodeURIComponent(rep.convId));
      const j = await r.json();
      if (r.ok) setMsgs(j.messages || []);
    } finally { setMsgLoading(false); }
  };

  const setStatus = async (rep: Report, status: 'open' | 'resolved') => {
    await authed('/api/admin/plaza/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rep.id, status }) });
    setRows((rs) => rs.map((x) => (x.id === rep.id ? { ...x, status } : x)));
    if (sel?.id === rep.id) setSel({ ...rep, status });
  };

  const shown = rows.filter((r) => filter === 'all' || r.status === 'open');
  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Bell size={22} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>키링 월드 신고</h1>
        <span style={{ fontSize: 13, color: '#8a98ab' }}>미처리 {openCount}건</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {(['open', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e6ee', background: filter === f ? '#1f2a3d' : '#fff', color: filter === f ? '#fff' : '#33415a', fontWeight: 600, cursor: 'pointer' }}>
              {f === 'open' ? '미처리' : '전체'}
            </button>
          ))}
          <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e2e6ee', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            <RefreshCw size={15} /> 새로고침
          </button>
        </div>
      </div>

      {err && <div style={{ marginTop: 16, color: '#c0392b' }}>⚠️ {err}</div>}

      <div className="plaza-rep-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 380px) 1fr', gap: 16, marginTop: 18, alignItems: 'start' }}>
        <div style={{ border: '1px solid #e8ecf3', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={18} /> 불러오는 중…</div>
          ) : shown.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}>{filter === 'open' ? '처리할 신고가 없어요.' : '신고가 없어요.'}</div>
          ) : shown.map((r) => (
            <button key={r.id} onClick={() => open(r)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid #f0f3f8', background: sel?.id === r.id ? '#eef4ff' : '#fff', cursor: 'pointer', opacity: r.status === 'resolved' ? 0.55 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 14, wordBreak: 'keep-all' }}>{r.targetNick || '(닉네임 없음)'}</b>
                <span style={{ fontSize: 12, color: '#9fb0c5', flex: '0 0 auto' }}>{fmt(r.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ background: '#fdecec', color: '#c0392b', borderRadius: 6, padding: '1px 7px', fontWeight: 700, fontSize: 12 }}>{r.reason}</span>
                <span style={{ color: '#67768b' }}>신고자 {r.reporterNick || r.reporter.slice(0, 6)}</span>
                {r.status === 'resolved' && <span style={{ color: '#2e9e5b', fontSize: 12 }}>처리됨</span>}
              </div>
            </button>
          ))}
        </div>

        <div style={{ border: '1px solid #e8ecf3', borderRadius: 14, background: '#fbfcfe', minHeight: 320, padding: 16 }}>
          {!sel ? (
            <div style={{ color: '#9fb0c5', textAlign: 'center', paddingTop: 100 }}>왼쪽에서 신고를 선택하세요.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 16 }}>{sel.targetNick || '(닉네임 없음)'}</b>
                <span style={{ background: '#fdecec', color: '#c0392b', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 12 }}>{sel.reason}</span>
                <div style={{ marginLeft: 'auto' }}>
                  {sel.status === 'open' ? (
                    <button onClick={() => setStatus(sel, 'resolved')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#2e9e5b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                      <CheckCircle2 size={15} /> 처리 완료
                    </button>
                  ) : (
                    <button onClick={() => setStatus(sel, 'open')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e6ee', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      <RotateCcw size={15} /> 미처리로 되돌리기
                    </button>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12, padding: 12, border: '1px solid #f3d6d6', background: '#fff8f8', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                  <Ban size={15} color="#c0392b" />
                  <b>키링 월드 입장 금지</b>
                  <span style={{ background: sel.targetType === 'member' ? '#e8f0ff' : '#f1f1f1', color: '#33415a', borderRadius: 6, padding: '1px 7px', fontSize: 12 }}>{sel.targetType === 'member' ? '회원' : '손님'}</span>
                  <span style={{ color: '#67768b' }}>
                    {!ban ? '상태 확인 중…' : ban.bannedUntil ? (ban.bannedUntil > 8e15 ? '영구 금지 중' : '금지 중 · ' + fmt(ban.bannedUntil) + ' 해제') : (ban.known ? '제한 없음' : '최근 접속 기록 없음')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {[[24, '24시간'], [168, '7일'], [0, '영구']].map(([h, label]) => (
                    <button key={String(h)} disabled={banBusy || !sel.tid} onClick={() => doBan(sel, Number(h))}
                      style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: Number(h) === 0 ? '#7a1f1f' : '#c0392b', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: banBusy ? 0.6 : 1 }}>
                      {label} 금지
                    </button>
                  ))}
                  {ban?.bannedUntil ? (
                    <button disabled={banBusy} onClick={() => doUnban(sel)} style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #e2e6ee', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>해제</button>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: '#8a98ab', marginTop: 8, lineHeight: 1.6 }}>지금 접속 중이면 즉시 퇴장돼요. 기기와 IP(암호화된 값)로 다시 들어오지 못하게 막아요.</div>
                {notice && <div style={{ fontSize: 13, color: '#c0392b', marginTop: 6 }}>{notice}</div>}
              </div>
              <div style={{ fontSize: 13, color: '#67768b', marginTop: 8, lineHeight: 1.7 }}>
                신고자: {sel.reporterNick || '-'} · {fmt(sel.createdAt)}<br />
                대상 회원 ID: {sel.targetUid ? <code>{sel.targetUid}</code> : '확인 불가(손님 또는 미가입)'}
                {sel.targetUid && <> · <Link href="/admin/users" style={{ color: '#3b6fd8' }}>회원 관리에서 찾기</Link></>}
              </div>
              {sel.detail && <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff', border: '1px solid #e8ecf3', borderRadius: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sel.detail}</div>}

              <div style={{ fontWeight: 800, margin: '16px 0 8px' }}>두 사람의 1:1 대화</div>
              {!sel.convId ? (
                <div style={{ color: '#9fb0c5' }}>연결된 대화가 없어요.</div>
              ) : msgLoading ? (
                <div style={{ color: '#9fb0c5' }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={16} /> 불러오는 중…</div>
              ) : msgs.length === 0 ? (
                <div style={{ color: '#9fb0c5' }}>저장된 대화가 없어요.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {msgs.map((m) => {
                    const isTarget = m.from === sel.targetUid;
                    return (
                      <div key={m.id} style={{ maxWidth: '78%', alignSelf: isTarget ? 'flex-start' : 'flex-end' }}>
                        <div style={{ fontSize: 11, color: isTarget ? '#c0392b' : '#9fb0c5', margin: '0 4px 2px' }}>{isTarget ? `신고 대상(${sel.targetNick})` : `신고자(${sel.reporterNick || '-'})`} · {fmt(m.at)}</div>
                        <div style={{ padding: '9px 13px', borderRadius: 12, background: isTarget ? '#fff4f4' : '#dbe9ff', border: '1px solid #e8ecf3', wordBreak: 'break-word' }}>{m.text}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 760px){ .plaza-rep-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
