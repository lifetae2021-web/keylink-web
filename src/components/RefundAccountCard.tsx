'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import toast from 'react-hot-toast';

type Item = {
  appId: string;
  sessionTitle: string;
  eventDate: string | null;
  amount: number;
  submitted: { bank: string; account: string; holder: string; at: string | null } | null;
};

/** 보증금 환불 대상(출석 확인 완료) 회원에게 환불 계좌를 받는 카드. 서버가 대상 여부를 판단한다. */
export default function RefundAccountCard({ authUser }: { authUser: User }) {
  const [items, setItems] = useState<Item[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ bank: '', account: '', holder: '' });
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  // 은행 선택 시트: 열려 있는 동안 뒤 화면 스크롤 잠금 + ESC로 닫기
  useEffect(() => {
    if (!picking) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [picking]);

  const load = async () => {
    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/me/refund', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
      setBanks(data.banks || []);
    } catch { /* 조용히 무시: 카드만 안 보임 */ }
  };

  useEffect(() => { load(); }, [authUser.uid]);

  if (items.length === 0) return null;

  const submit = async (appId: string) => {
    if (!form.bank) return toast.error('은행을 골라 주세요');
    if (form.account.replace(/[^0-9]/g, '').length < 8) return toast.error('계좌번호를 확인해 주세요');
    if (form.holder.trim().length < 2) return toast.error('예금주를 적어 주세요');
    setSaving(true);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/me/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appId, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '저장하지 못했어요');
      toast.success('환불 계좌가 접수됐어요');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #BAE6FD',
    fontSize: '0.95rem', background: '#fff', color: '#0F172A', boxSizing: 'border-box',
  };

  return (
    <>
      {items.map((it) => {
        const d = it.eventDate ? new Date(it.eventDate) : null;
        const when = d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '';
        const isEditing = editing === it.appId || !it.submitted;
        return (
          <div key={it.appId} style={{ background: '#F0F9FF', border: '1.5px solid #7DD3FC', borderRadius: '20px', padding: '20px', marginBottom: '16px', wordBreak: 'keep-all' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: '#0284C7', color: '#fff', fontWeight: 900, fontSize: '0.8rem', padding: '4px 10px', borderRadius: '100px', whiteSpace: 'nowrap' }}>
                {it.submitted ? '접수 완료' : '보증금 환불'}
              </span>
              <span style={{ fontWeight: 900, color: '#075985', fontSize: '1rem' }}>
                {it.submitted ? '환불 계좌가 접수됐어요' : '환불 계좌를 적어 주세요'}
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#0C4A6E', lineHeight: 1.6, margin: '0 0 14px' }}>
              {it.submitted
                ? '확인 후 순서대로 입금해 드릴게요.'
                : `${when} ${it.sessionTitle} 출석이 확인됐어요. 보증금을 돌려 드릴 계좌를 알려 주세요.`}
            </p>

            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button type="button" onClick={() => setPicking(true)} aria-label="은행" aria-haspopup="dialog"
                  style={{ ...input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', color: form.bank ? '#0F172A' : '#94A3B8', fontWeight: form.bank ? 700 : 400 }}>
                  <span>{form.bank || '은행 선택'}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <input inputMode="numeric" placeholder="계좌번호 (숫자만)" value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value.replace(/[^0-9-]/g, '') })} style={input} aria-label="계좌번호" />
                <input placeholder="예금주" value={form.holder} maxLength={20}
                  onChange={(e) => setForm({ ...form, holder: e.target.value })} style={input} aria-label="예금주" />
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {it.submitted && (
                    <button onClick={() => setEditing(null)} disabled={saving}
                      style={{ flex: 1, padding: '13px', borderRadius: '12px', border: '1.5px solid #BAE6FD', background: '#fff', color: '#0369A1', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
                      취소
                    </button>
                  )}
                  <button onClick={() => submit(it.appId)} disabled={saving}
                    style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', background: '#0284C7', color: '#fff', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? '보내는 중' : '계좌 보내기'}
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0' }}>입금에만 쓰고 운영진만 볼 수 있어요.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#fff', borderRadius: '12px', padding: '12px 14px' }}>
                <span style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 700 }}>
                  {it.submitted!.bank} {it.submitted!.account} · {it.submitted!.holder}
                </span>
                <button onClick={() => { setForm({ bank: it.submitted!.bank, account: '', holder: it.submitted!.holder }); setEditing(it.appId); }}
                  style={{ border: 'none', background: 'transparent', color: '#0284C7', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  바꾸기
                </button>
              </div>
            )}
          </div>
        );
      })}

      {picking && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setPicking(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'rfFade .18s ease-out' }}>
          <style>{`@keyframes rfFade{from{opacity:0}to{opacity:1}}@keyframes rfUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@media (prefers-reduced-motion:reduce){.rf-sheet{animation:none!important}}`}</style>
          <div role="dialog" aria-modal="true" aria-label="은행 선택" className="rf-sheet"
            style={{ width: '100%', maxWidth: '460px', maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: '24px 24px 0 0', padding: '12px 20px calc(24px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', animation: 'rfUp .24s cubic-bezier(.2,.8,.2,1)', wordBreak: 'keep-all' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '4px', background: '#E2E8F0', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0F172A' }}>은행을 골라 주세요</span>
              <button type="button" onClick={() => setPicking(false)} aria-label="닫기"
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              {banks.map((b) => {
                const on = form.bank === b;
                return (
                  <button key={b} type="button" onClick={() => { setForm((f) => ({ ...f, bank: b })); setPicking(false); }}
                    style={{ padding: '14px 4px', borderRadius: '14px', border: on ? '2px solid #0284C7' : '1.5px solid #E2E8F0', background: on ? '#E0F2FE' : '#F8FAFC', color: on ? '#0369A1' : '#1E293B', fontWeight: on ? 900 : 700, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
