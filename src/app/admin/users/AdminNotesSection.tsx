'use client';

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Note {
  id: string;
  text: string;
  authorName?: string;
  createdAt?: any;
}

// 관리자 전용 회원 메모 (users/{uid}/adminNotes) - 회원 본인에게는 보이지 않음
export default function AdminNotesSection({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users', userId, 'adminNotes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
    }, err => console.error('adminNotes load failed', err));
  }, [userId]);

  const handleAdd = async () => {
    const value = text.trim();
    if (!value || isSaving) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'users', userId, 'adminNotes'), {
        text: value,
        authorUid: auth.currentUser?.uid || null,
        authorName: auth.currentUser?.displayName || auth.currentUser?.email || '관리자',
        createdAt: serverTimestamp(),
      });
      setText('');
    } catch (error) {
      console.error(error);
      toast.error('메모 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('이 메모를 삭제할까요?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'adminNotes', noteId));
    } catch (error) {
      console.error(error);
      toast.error('메모 삭제에 실패했습니다.');
    }
  };

  const formatDate = (ts: any) => {
    const d = ts?.toDate?.();
    if (!d) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="pt-6 pb-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-3 bg-amber-400 rounded-full" />
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Admin Memo</span>
        <span className="text-[10px] text-slate-300">관리자만 볼 수 있어요</span>
      </div>

      <div className="flex gap-2 mb-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd(); }}
          placeholder="이 회원에 대한 메모를 남겨주세요 (Ctrl/⌘+Enter로 저장)"
          rows={2}
          className="flex-1 px-3 py-2 text-sm rounded-2xl border border-amber-100 bg-amber-50/40 focus:outline-none focus:border-amber-300 resize-none"
        />
        <button
          onClick={handleAdd}
          disabled={!text.trim() || isSaving}
          className="px-4 rounded-2xl bg-amber-400 text-white text-xs font-black disabled:opacity-40 hover:bg-amber-500 transition-colors"
        >
          저장
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-xs text-slate-300 italic text-center py-3">등록된 메모가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <div key={n.id} className="group p-3 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{n.text}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-slate-400">{n.authorName} · {formatDate(n.createdAt)}</span>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                  title="메모 삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
