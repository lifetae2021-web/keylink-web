'use client';

import { useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { Loader2, RefreshCw, ShieldAlert, MessageSquare } from 'lucide-react';

interface ChatRow {
  convId: string;
  participants: string[];
  nicks: Record<string, string>;
  lastMessage: string;
  lastFrom: string;
  lastAt: number | null;
}
interface Msg { id: string; from: string; text: string; at: number | null }

const fmt = (ms: number | null) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function PlazaChatsPage() {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<ChatRow | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const token = async () => auth.currentUser?.getIdToken();

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const t = await token();
      const r = await fetch('/api/admin/plaza/chats?limit=200', { headers: { Authorization: 'Bearer ' + t } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '불러오기 실패');
      setRows(j.chats || []);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openConv = async (row: ChatRow) => {
    setSel(row); setMsgs([]); setMsgLoading(true);
    try {
      const t = await token();
      const r = await fetch('/api/admin/plaza/chats/' + encodeURIComponent(row.convId), { headers: { Authorization: 'Bearer ' + t } });
      const j = await r.json();
      if (r.ok) setMsgs(j.messages || []);
    } finally { setMsgLoading(false); }
  };

  const nameOf = (row: ChatRow, uid: string) => row.nicks?.[uid] || (uid ? uid.slice(0, 6) + '…' : '?');
  const pairLabel = (row: ChatRow) => {
    const [a, b] = row.participants;
    return `${nameOf(row, a)} ↔ ${nameOf(row, b)}`;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <MessageSquare size={22} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>광장 1:1 대화</h1>
        <button onClick={load} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e2e6ee', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          <RefreshCw size={15} /> 새로고침
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, color: '#8a98ab', fontSize: 13, lineHeight: 1.6 }}>
        <ShieldAlert size={16} style={{ flex: '0 0 auto', marginTop: 2 }} />
        <span>음란·범죄 예방을 위한 모더레이션용 열람입니다. 최근 대화 순으로 표시돼요. 개인정보이니 열람 기록·목적에 유의하세요.</span>
      </div>

      {err && <div style={{ marginTop: 16, color: '#c0392b' }}>⚠️ {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 340px) 1fr', gap: 16, marginTop: 18, alignItems: 'start' }} className="plaza-chat-grid">
        {/* 대화 목록 */}
        <div style={{ border: '1px solid #e8ecf3', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={18} /> 불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9fb0c5' }}>아직 광장 대화가 없어요.</div>
          ) : rows.map((row) => (
            <button key={row.convId} onClick={() => openConv(row)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid #f0f3f8', background: sel?.convId === row.convId ? '#eef4ff' : '#fff', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 14, wordBreak: 'keep-all' }}>{pairLabel(row)}</b>
                <span style={{ fontSize: 12, color: '#9fb0c5', flex: '0 0 auto' }}>{fmt(row.lastAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#67768b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(row, row.lastFrom)}: {row.lastMessage}
              </div>
            </button>
          ))}
        </div>

        {/* 메시지 상세 */}
        <div style={{ border: '1px solid #e8ecf3', borderRadius: 14, background: '#fbfcfe', minHeight: 320, padding: 16 }}>
          {!sel ? (
            <div style={{ color: '#9fb0c5', textAlign: 'center', paddingTop: 100 }}>왼쪽에서 대화를 선택하세요.</div>
          ) : (
            <>
              <div style={{ fontWeight: 800, marginBottom: 12 }}>{pairLabel(sel)}</div>
              {msgLoading ? (
                <div style={{ color: '#9fb0c5', textAlign: 'center', paddingTop: 60 }}><Loader2 className="animate-spin" style={{ display: 'inline' }} size={18} /> 불러오는 중…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {msgs.map((m) => (
                    <div key={m.id} style={{ maxWidth: '78%', alignSelf: m.from === sel.participants[0] ? 'flex-start' : 'flex-end' }}>
                      <div style={{ fontSize: 11, color: '#9fb0c5', margin: '0 4px 2px' }}>{nameOf(sel, m.from)} · {fmt(m.at)}</div>
                      <div style={{ padding: '9px 13px', borderRadius: 12, background: m.from === sel.participants[0] ? '#fff' : '#dbe9ff', border: '1px solid #e8ecf3', wordBreak: 'break-word' }}>{m.text}</div>
                    </div>
                  ))}
                  {msgs.length === 0 && <div style={{ color: '#9fb0c5', textAlign: 'center' }}>메시지가 없어요.</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 760px){ .plaza-chat-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
