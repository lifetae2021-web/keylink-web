'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getNotices, addNotice, updateNotice, deleteNotice, NoticeItem,
  getFaqs, addFaq, updateFaq, deleteFaq, FaqItem,
  getContent, saveContent, ContentKey,
  getReviews, addReview, updateReview, deleteReview, ReviewItem,
} from '@/lib/firestore/cms';

type Group = 'ops' | 'legal';
type Tab = 'notices' | 'faqs' | 'rules' | 'reviews' | 'terms' | 'privacy';

const card = 'bg-white border border-slate-200 rounded-xl shadow-sm';

export default function CmsPage() {
  const [group, setGroup] = useState<Group>('ops');
  const [tab, setTab] = useState<Tab>('notices');

  const OPS_TABS = [
    { key: 'notices' as Tab, label: '📢 공지사항' },
    { key: 'faqs'    as Tab, label: '❓ FAQ' },
    { key: 'rules'   as Tab, label: '📋 이용 규정' },
    { key: 'reviews' as Tab, label: '💛 후기' },
  ];
  const LEGAL_TABS = [
    { key: 'terms'   as Tab, label: '⚖ 이용약관' },
    { key: 'privacy' as Tab, label: '🔒 개인정보처리방침' },
  ];
  const subTabs = group === 'ops' ? OPS_TABS : LEGAL_TABS;

  return (
    <div className="space-y-6 animate-in fade-in duration-400">
      <div>
        <h2 className="text-slate-900 text-xl font-bold">콘텐츠 편집</h2>
        <p className="text-slate-500 text-[0.85rem] mt-1">공지사항, FAQ, 법적 문서를 관리합니다.</p>
      </div>

      {/* 그룹 탭 */}
      <div className="flex gap-2">
        {([
          { key: 'ops'   as Group, label: '운영' },
          { key: 'legal' as Group, label: '법적 문서' },
        ]).map(g => (
          <button
            key={g.key}
            onClick={() => {
              setGroup(g.key);
              setTab(g.key === 'ops' ? 'notices' : 'terms');
            }}
            className={`px-5 py-2 text-sm font-bold rounded-full border transition-all ${
              group === g.key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 서브 탭 */}
      <div className="flex gap-1 border-b border-slate-200">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-all ${
              tab === t.key ? 'border-[#FF6F61] text-[#FF6F61]' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notices' && <NoticesTab />}
      {tab === 'faqs' && <FaqsTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {(tab === 'rules' || tab === 'terms' || tab === 'privacy') && <ContentTab contentKey={tab} />}
    </div>
  );
}

// ── 공지사항 탭 ──────────────────────────────────────────
function NoticesTab() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', isImportant: false, date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      setItems(await getNotices());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({ title: '', content: '', isImportant: false, date: new Date().toISOString().slice(0, 10) });
    setShowForm(true);
  };

  const openEdit = (item: NoticeItem) => {
    setEditingId(item.id);
    setForm({ title: item.title, content: item.content, isImportant: item.isImportant, date: item.date });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateNotice(editingId, form);
        toast.success('공지사항이 수정되었습니다.');
      } else {
        await addNotice(form);
        toast.success('공지사항이 등록되었습니다.');
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 공지사항을 삭제하시겠습니까?`)) return;
    await deleteNotice(id);
    toast.success('삭제되었습니다.');
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
          style={{ background: '#FF6F61' }}
        >
          <Plus size={15} /> 새 공지사항
        </button>
      </div>

      {/* 폼 */}
      {showForm && (
        <div className={`${card} p-6 space-y-4`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800">{editingId ? '공지사항 수정' : '새 공지사항'}</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">제목</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]"
                placeholder="공지사항 제목"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">날짜</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="isImportant"
                checked={form.isImportant}
                onChange={e => setForm(f => ({ ...f, isImportant: e.target.checked }))}
                className="w-4 h-4 accent-[#FF6F61]"
              />
              <label htmlFor="isImportant" className="text-sm font-bold text-slate-600">중요 공지</label>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">내용</label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61] resize-none"
                placeholder="공지사항 내용을 입력하세요."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all"
              style={{ background: '#FF6F61', opacity: saving ? 0.6 : 1 }}
            >
              <Save size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">등록된 공지사항이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={`${card} p-5 flex items-start gap-4`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {item.isImportant && <Star size={13} className="text-[#FF6F61]" fill="#FF6F61" />}
                  <span className="font-bold text-slate-800 text-sm truncate">{item.title}</span>
                  <span className="text-xs text-slate-400 shrink-0">{item.date}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{item.content}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(item)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(item.id, item.title)} className="p-2 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FAQ 탭 ──────────────────────────────────────────────
function FaqsTab() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ q: '', a: '', order: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getFaqs();
      setItems(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({ q: '', a: '', order: items.length + 1 });
    setShowForm(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setForm({ q: item.q, a: item.a, order: item.order });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.q.trim() || !form.a.trim()) {
      toast.error('질문과 답변을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateFaq(editingId, form);
        toast.success('FAQ가 수정되었습니다.');
      } else {
        await addFaq(form);
        toast.success('FAQ가 등록되었습니다.');
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, q: string) => {
    if (!confirm(`"${q}" FAQ를 삭제하시겠습니까?`)) return;
    await deleteFaq(id);
    toast.success('삭제되었습니다.');
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
          style={{ background: '#FF6F61' }}
        >
          <Plus size={15} /> 새 FAQ
        </button>
      </div>

      {/* 폼 */}
      {showForm && (
        <div className={`${card} p-6 space-y-4`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800">{editingId ? 'FAQ 수정' : '새 FAQ'}</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">순서</label>
            <input
              type="number"
              value={form.order}
              onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
              className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">질문</label>
            <input
              value={form.q}
              onChange={e => setForm(f => ({ ...f, q: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]"
              placeholder="자주 묻는 질문"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">답변</label>
            <textarea
              value={form.a}
              onChange={e => setForm(f => ({ ...f, a: e.target.value }))}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61] resize-none"
              placeholder="답변 내용"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all"
              style={{ background: '#FF6F61', opacity: saving ? 0.6 : 1 }}
            >
              <Save size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">등록된 FAQ가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={`${card} p-5 flex items-start gap-4`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-[#FF6F61] bg-orange-50 px-2 py-0.5 rounded-full">#{item.order}</span>
                  <span className="font-bold text-slate-800 text-sm">{item.q}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{item.a}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(item)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(item.id, item.q)} className="p-2 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 후기 탭 ──────────────────────────────────────────────
function ReviewsTab() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ maleName: '', femaleName: '', text: '', episode: '', region: '부산', order: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try { setItems(await getReviews()); } finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({ maleName: '', femaleName: '', text: '', episode: '', region: '부산', order: items.length + 1 });
    setShowForm(true);
  };

  const openEdit = (item: ReviewItem) => {
    setEditingId(item.id);
    const parts = item.couple.split(' ❤ ');
    setForm({ maleName: parts[0] || '', femaleName: parts[1] || '', text: item.text, episode: item.episode, region: item.region, order: item.order });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.maleName.trim() || !form.femaleName.trim() || !form.text.trim()) {
      toast.error('남성/여성 이름과 후기 내용을 입력해주세요.');
      return;
    }
    const couple = `${form.maleName} ❤ ${form.femaleName}`;
    const { maleName, femaleName, ...rest } = form;
    setSaving(true);
    try {
      if (editingId) {
        await updateReview(editingId, { ...rest, couple });
        toast.success('후기가 수정되었습니다.');
      } else {
        await addReview({ ...rest, couple });
        toast.success('후기가 등록되었습니다.');
      }
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, couple: string) => {
    if (!confirm(`"${couple}" 후기를 삭제하시겠습니까?`)) return;
    await deleteReview(id);
    toast.success('삭제되었습니다.');
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: '#FF6F61' }}>
          <Plus size={15} /> 새 후기
        </button>
      </div>

      {showForm && (
        <div className={`${card} p-6 space-y-4`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800">{editingId ? '후기 수정' : '새 후기'}</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">남성 이름</label>
              <input value={form.maleName} onChange={e => setForm(f => ({ ...f, maleName: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]" placeholder="김*수" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">여성 이름</label>
              <div className="flex items-center gap-2">
                <span className="text-[#FF6F61] font-bold text-sm">❤</span>
                <input value={form.femaleName} onChange={e => setForm(f => ({ ...f, femaleName: e.target.value }))} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]" placeholder="박*연" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">기수</label>
              <input value={form.episode} onChange={e => setForm(f => ({ ...f, episode: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]" placeholder="120기" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">지역</label>
              <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]">
                <option>부산</option>
                <option>창원</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">순서</label>
              <input type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61]" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">후기 내용</label>
              <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61] resize-none" placeholder="후기 내용을 입력하세요." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: '#FF6F61', opacity: saving ? 0.6 : 1 }}>
              <Save size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">등록된 후기가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={`${card} p-5 flex items-start gap-4`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-[#FF6F61] bg-orange-50 px-2 py-0.5 rounded-full">#{item.order}</span>
                  <span className="font-bold text-slate-800 text-sm">{item.couple}</span>
                  <span className="text-xs text-slate-400">{item.region} {item.episode}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{item.text}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(item)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(item.id, item.couple)} className="p-2 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 단일 콘텐츠 탭 (이용규정 / 이용약관 / 개인정보처리방침) ──
const CONTENT_LABELS: Record<ContentKey, string> = {
  rules:   '이용 규정',
  terms:   '이용약관',
  privacy: '개인정보처리방침',
};

function ContentTab({ contentKey }: { contentKey: ContentKey }) {
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    getContent(contentKey).then(text => {
      setBody(text);
      setIsLoading(false);
    });
  }, [contentKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveContent(contentKey, body);
      toast.success(`${CONTENT_LABELS[contentKey]}이 저장되었습니다.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{CONTENT_LABELS[contentKey]}</h3>
          <button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all"
            style={{ background: '#FF6F61', opacity: (saving || isLoading) ? 0.6 : 1 }}
          >
            <Save size={14} /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
        {isLoading ? (
          <div className="text-center py-10 text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={24}
            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#FF6F61] resize-y font-mono leading-relaxed"
            placeholder={`${CONTENT_LABELS[contentKey]} 내용을 입력하세요.`}
          />
        )}
        <p className="text-xs text-slate-400">줄바꿈은 그대로 반영됩니다.</p>
      </div>
    </div>
  );
}
