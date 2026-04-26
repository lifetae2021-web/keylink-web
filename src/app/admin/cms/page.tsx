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
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

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

  const handleSeedNotices = async () => {
    const defaultNotices = [
      { title: '[환영합니다] 프리미엄 매칭 서비스 키링크(Keylink) 오픈 안내', content: '안녕하세요. 신뢰 기반 프리미엄 매칭 서비스 키링크입니다.\n\n키링크는 가벼운 만남을 지양하고, 철저한 신원 인증과 재직 증명을 통과한 분들만 모이는 프라이빗한 로테이션 소개팅 플랫폼입니다.\n\n앞으로도 진정성 있는 만남을 위해 최선을 다하겠습니다. 많은 관심 부탁드립니다!', isImportant: true, date: new Date().toISOString().slice(0, 10) },
      { title: '[정책 안내] 노쇼(No-Show) 및 비매너 회원 영구제명 조치 강화', content: '참석자 전원의 소중한 시간과 감정을 지키기 위해, 당일 무단 불참(노쇼) 및 현장에서의 불쾌한 비매너 행동 적발 시 즉시 서비스 영구제명 처리됨을 알려드립니다.\n\n매너 있고 건강한 만남 문화를 위해 회원님들의 적극적인 협조 부탁드립니다.', isImportant: true, date: new Date().toISOString().slice(0, 10) },
      { title: '[꿀팁] 매칭 확률을 3배 높여주는 상세 신청서 작성법', content: '키링크의 로테이션 소개팅에서 매칭 성공률을 극대화하려면 사전 프로필이 매우 중요합니다!\n\n1. 취미는 구체적으로! (예: "음악감상" 보다는 "주말에 재즈바 가기")\n2. 이상형은 긍정적으로! (예: "연락 안되는 사람 싫음" 보다는 "연락이 잘 되는 사람")\n3. 사진은 밝은 표정의 단독 사진으로!\n\n정성스러운 프로필로 좋은 인연을 만나보세요.', isImportant: false, date: new Date().toISOString().slice(0, 10) }
    ];
    
    if (!confirm('추천 공지사항 3개를 자동으로 등록하시겠습니까?')) return;
    
    setSaving(true);
    toast.loading('공지사항 등록 중...', { id: 'seed' });
    try {
      for (const notice of defaultNotices) {
        await addNotice(notice);
      }
      toast.success('추천 공지사항이 등록되었습니다!', { id: 'seed' });
      await load();
    } catch (err) {
      toast.error('등록 중 오류가 발생했습니다.', { id: 'seed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={handleSeedNotices}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
        >
          ✨ 추천 공지사항 자동 입력
        </button>
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

  const handleSeedFaqs = async () => {
    const defaultFaqs = [
      { q: '이상한 사람이 나오면 어떡하죠? 신원 검증은 어떻게 하나요?', a: '키링크는 100% 신원 및 재직 인증제로 운영됩니다. 가입 시 제출해주신 재직증명서(명함, 사원증 등)와 본인 사진을 꼼꼼히 대조 및 검수하며, 허위 사실 기재나 비매너 행동이 적발될 경우 즉시 영구제명 조치하여 안전한 환경을 유지하고 있습니다.', order: 1 },
      { q: '아는 사람(지인, 직장 동료)을 마주칠까 봐 걱정돼요.', a: '걱정하지 마세요! 신청서 작성 시 \'지인 마주침 방지\' 항목에 피하고 싶은 직장명이나 지인의 연락처를 적어주시면, 매칭 팀에서 해당 인원과 절대 같은 기수에 배정되지 않도록 철저하게 필터링해 드립니다.', order: 2 },
      { q: '\'로테이션 소개팅\'은 어떤 방식으로 진행되나요?', a: '남녀 각각 8명씩 참석하여, 프라이빗한 공간에서 1:1로 약 15분씩 대화를 나눕니다. 시간이 지나면 남성분들이 옆자리로 이동하는 방식으로 진행되어, 참석하신 모든 이성분과 최소 1번 이상 깊이 있는 대화를 나누실 수 있습니다.', order: 3 },
      { q: '낯을 많이 가리는데, 대화가 끊기면 어색하지 않을까요?', a: '키링크는 대화가 끊기지 않도록 서로의 성향, 취미, 가치관 등이 적힌 \'프로필 카드\'와 흥미로운 \'대화 주제 질문지\'를 기본으로 제공합니다. 낯을 가리시는 분들도 자연스럽게 이야기꽃을 피우실 수 있으니 가벼운 마음으로 오시면 됩니다!', order: 4 },
      { q: '복장(드레스코드)은 어떻게 입고 가야 하나요?', a: '과하게 꾸민 정장보다는 \'깔끔한 비즈니스 캐주얼\'이나 \'첫 데이트에 입고 나갈 만한 단정한 사복\'을 추천해 드립니다. (트레이닝복, 모자, 슬리퍼 등은 입장이 제한될 수 있습니다.)', order: 5 },
      { q: '늦게 도착할 것 같은데 지각해도 되나요?', a: '행사는 정각에 시작되며, 로테이션 방식의 특성상 한 분이 늦으시면 다른 모든 분들의 대화 시간에 큰 피해가 갑니다. 따라서 행사 시작 10분 전까지 반드시 도착해 주셔야 하며, 무단 지각 시 입장이 제한되고 환불이 불가합니다.', order: 6 },
      { q: '매칭 결과는 어떻게, 언제 알 수 있나요?', a: '모든 대화가 끝난 후, 호감 가는 이성을 \'호감도 투표지\'에 체크하여 제출하시게 됩니다. 행사가 종료된 당일 저녁, 서로의 마음이 통하여 최종 매칭된 커플에게만 개별적으로 연락처(혹은 오픈채팅방 링크)를 전달해 드립니다.', order: 7 },
      { q: '[남성 안심 패키지] 아무와도 매칭되지 않으면 정말 환불해 주나요?', a: '네, 맞습니다! 안심 패키지를 선택하신 남성 회원님의 경우, 행사에 정상적으로 참여하셨음에도 단 한 명과도 매칭이 성사되지 않았다면 약속드린 정책에 따라 조건 없이 환불해 드립니다. 그만큼 매칭률에 자신 있습니다.', order: 8 }
    ];
    
    if (!confirm('추천 FAQ 8개를 자동으로 등록하시겠습니까?')) return;
    
    setSaving(true);
    toast.loading('FAQ 등록 중...', { id: 'seed' });
    try {
      for (const faq of defaultFaqs) {
        await addFaq(faq);
      }
      toast.success('추천 FAQ가 모두 등록되었습니다!', { id: 'seed' });
      await load();
    } catch (err) {
      toast.error('등록 중 오류가 발생했습니다.', { id: 'seed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={handleSeedFaqs}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
        >
          ✨ 추천 FAQ 자동 입력
        </button>
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
  const [form, setForm] = useState({ maleName: '', femaleName: '', text: '', episode: '', region: '부산', order: 0, imageUrl: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try { setItems(await getReviews()); } finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({ maleName: '', femaleName: '', text: '', episode: '', region: '부산', order: items.length + 1, imageUrl: '' });
    setShowForm(true);
  };

  const openEdit = (item: ReviewItem) => {
    setEditingId(item.id);
    const parts = item.couple.split(' ❤ ');
    const mNum = parts[0]?.replace(/[^0-9]/g, '') || '';
    const fNum = parts[1]?.replace(/[^0-9]/g, '') || '';
    const epNum = item.episode.replace(/[^0-9]/g, '');
    setForm({ maleName: mNum, femaleName: fNum, text: item.text, episode: epNum, region: item.region, order: item.order, imageUrl: item.imageUrl || '' });
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.loading('사진 업로드 중...', { id: 'img-upload' });
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const imgRef = ref(storage, `cms_reviews/${Date.now()}_${file.name}`);
        await uploadString(imgRef, dataUrl, 'data_url');
        const url = await getDownloadURL(imgRef);
        setForm(f => ({ ...f, imageUrl: url }));
        toast.success('사진 업로드 완료', { id: 'img-upload' });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('사진 업로드 실패', { id: 'img-upload' });
    }
  };

  const handleSave = async () => {
    if (!form.maleName.trim() || !form.femaleName.trim() || !form.text.trim() || !form.episode.trim()) {
      toast.error('호수, 기수, 후기 내용을 입력해주세요.');
      return;
    }
    const couple = `키링남 ${form.maleName}호 ❤ 키링녀 ${form.femaleName}호`;
    const finalEpisode = `${form.episode}기`;
    const { maleName, femaleName, episode, ...rest } = form;
    setSaving(true);
    try {
      if (editingId) {
        await updateReview(editingId, { ...rest, couple, episode: finalEpisode });
        toast.success('후기가 수정되었습니다.');
      } else {
        await addReview({ ...rest, couple, episode: finalEpisode });
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
              <label className="text-xs font-bold text-slate-500 mb-1 block">남성 (키링남 O호)</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold text-sm">키링남</span>
                <input type="number" value={form.maleName} onChange={e => setForm(f => ({ ...f, maleName: e.target.value }))} className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61] text-center" placeholder="1" />
                <span className="text-slate-600 font-bold text-sm">호</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">여성 (키링녀 O호)</label>
              <div className="flex items-center gap-2">
                <span className="text-[#FF6F61] font-bold text-sm">❤</span>
                <span className="text-slate-600 font-bold text-sm">키링녀</span>
                <input type="number" value={form.femaleName} onChange={e => setForm(f => ({ ...f, femaleName: e.target.value }))} className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61] text-center" placeholder="1" />
                <span className="text-slate-600 font-bold text-sm">호</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">기수 (숫자만)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.episode} onChange={e => setForm(f => ({ ...f, episode: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6F61] text-center" placeholder="120" />
                <span className="text-slate-600 font-bold text-sm shrink-0">기</span>
              </div>
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
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">후기 사진 첨부 (선택)</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm border border-slate-200 rounded-lg p-1 w-full max-w-xs" />
                {form.imageUrl && <img src={form.imageUrl} alt="preview" className="h-10 w-10 object-cover rounded-md border" />}
                {form.imageUrl && <button onClick={() => setForm(f => ({...f, imageUrl: ''}))} className="text-xs text-rose-500 font-bold px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 transition-colors">삭제</button>}
              </div>
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
                {item.imageUrl && (
                  <div className="mt-2">
                    <img src={item.imageUrl} alt="preview" className="h-12 w-12 object-cover rounded border border-slate-200" />
                  </div>
                )}
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

  const handleLoadTemplate = () => {
    if (!confirm('기존에 작성된 내용이 있다면 지워지고 추천 템플릿으로 덮어씌워집니다. 진행하시겠습니까?')) return;
    
    let template = '';
    if (contentKey === 'rules') {
      template = `제1조 (목적)\n본 규정은 키링크(Keylink) 프리미엄 매칭 서비스의 원활한 운영과 회원 간의 안전하고 매너 있는 만남을 보장하기 위해 제정되었습니다.\n\n제2조 (행사 참여 규칙)\n1. 지각 금지: 로테이션 방식의 특성상 1인의 지각이 전체 행사 일정에 지장을 줍니다. 행사 시작 10분 전까지 착석해야 하며, 지각 시 입장이 제한될 수 있습니다.\n2. 개인정보 보호: 행사 중 제공되는 타인의 프로필(직업, 나이 등)을 외부로 유출하거나 무단 캡처, 공유하는 행위를 엄격히 금지합니다.\n3. 매너 있는 대화: 상대방에게 불쾌감을 주는 언행(과도한 호구조사, 외모 비하, 정치/종교 강요 등)은 금지됩니다.\n\n제3조 (영구 제명 및 페널티)\n다음 각 호에 해당하는 경우, 즉시 퇴장 조치되며 향후 키링크의 모든 서비스 이용이 영구적으로 제한됩니다.\n1. 행사 당일 무단 불참(노쇼)\n2. 가입 시 허위 정보(나이, 직업, 혼인 여부 등) 기재가 적발된 경우\n3. 행사 전/후 상대방의 동의 없는 일방적이고 불쾌한 연락 (스토킹 등)\n4. 다단계, 영업, 종교 포교 등 만남 외의 목적이 확인된 경우\n\n제4조 (환불 보장 및 취소 정책)\n1. 행사 확정 후 개인 사유로 인한 취소 및 환불은 원칙적으로 불가합니다.\n2. 과거 만났던 상대와 동일한 기수에 배정된 경우, 즉시 운영진에게 알리면 100% 환불 처리됩니다.\n3. [남성 안심 패키지] 이용자의 경우, 규정에 명시된 횟수만큼 매칭 실패 시 정해진 비율로 환불됩니다.`;
    } else if (contentKey === 'terms') {
      template = `제1조 (목적)\n본 약관은 키링크(이하 "회사")가 제공하는 오프라인 매칭 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 회원 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.\n\n제2조 (용어의 정의)\n1. "서비스"란 회사가 회원에게 제공하는 프리미엄 로테이션 소개팅 및 관련 부가 서비스를 의미합니다.\n2. "회원"이란 본 약관에 동의하고 서비스에 가입하여, 회사가 제공하는 서비스를 이용하는 고객을 의미합니다.\n\n제3조 (서비스의 제공 및 변경)\n1. 회사는 회원에게 정해진 일정과 장소에서 1:1 로테이션 대화 방식의 매칭 서비스를 제공합니다.\n2. 회사는 운영상, 기술상의 필요에 따라 제공하고 있는 서비스를 변경할 수 있으며, 이 경우 사전에 공지합니다.\n\n제4조 (회원의 의무)\n1. 회원은 서비스 가입 및 이용 시 사실에 기반한 정확한 정보(나이, 직업, 혼인 여부 등)를 제공해야 합니다.\n2. 회원은 타인의 개인정보를 도용하거나, 불건전한 목적으로 서비스를 이용해서는 안 됩니다.\n\n제5조 (환불 정책)\n1. 결제 후 행사가 최종 확정되기 전까지는 취소가 가능하나, 확정(매칭 완료) 후에는 환불이 불가합니다.\n2. 회사의 귀책사유로 행사가 취소되거나 파행된 경우 전액 환불합니다.\n3. 중복 만남 방지 정책 등 회사 측이 보장한 조건이 충족되지 않은 경우 규정에 따라 환불을 진행합니다.`;
    } else if (contentKey === 'privacy') {
      template = `제1조 (수집하는 개인정보 항목)\n회사는 원활한 매칭 서비스 제공을 위해 아래의 개인정보를 수집하고 있습니다.\n1. 필수항목: 이름, 성별, 생년월일, 연락처, 직업/직장명, 거주지, 본인 사진, 재직 증명 서류\n2. 선택항목: 종교, 취미, 이상형, 인스타그램 ID 등\n\n제2조 (개인정보의 수집 및 이용 목적)\n회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.\n1. 본인 확인 및 신원/재직 인증 (안전한 만남 환경 조성)\n2. 개인 성향 및 조건에 맞춘 최적의 로테이션 매칭 파트너 배정\n3. 행사 일정 안내 및 고객 CS 처리\n\n제3조 (개인정보의 보유 및 이용 기간)\n원칙적으로, 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계 법령의 규정에 의하여 보존할 필요가 있는 경우 일정 기간 보관합니다.\n- 재직 증명 서류: 본인 인증 완료 즉시 즉각 파기 (별도 저장하지 않음)\n- 회원 프로필: 회원 탈퇴 시까지 보관\n\n제4조 (개인정보의 제3자 제공)\n회사는 회원의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 행사 진행 시 최소한의 식별 정보(이름의 일부, 나이, 직업군 등)만 프로필 카드 형태로 매칭 상대에게 제공됩니다.`;
    }
    setBody(template);
    toast.success('추천 템플릿이 로드되었습니다. 꼭 저장 버튼을 눌러주세요!');
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{CONTENT_LABELS[contentKey]}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
            >
              ✨ 추천 템플릿 자동 입력
            </button>
            <button
              onClick={handleSave}
              disabled={saving || isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all"
              style={{ background: '#FF6F61', opacity: (saving || isLoading) ? 0.6 : 1 }}
            >
              <Save size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
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
