'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import {
  Plus, Trash2, Pencil, Check, X, MessageSquare,
  Info, Copy, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

// 사용 가능한 변수 목록
const VARIABLES = [
  { key: '{{이름}}',  desc: '참여자 이름' },
  { key: '{{날짜}}',  desc: '행사 날짜 (MM/DD)' },
  { key: '{{요일}}',  desc: '행사 요일 (월~일)' },
  { key: '{{시간}}',  desc: '행사 시작 시간' },
  { key: '{{금액}}',  desc: '결제 금액' },
  { key: '{{기수}}',  desc: '기수 정보 (예: 부산 125기)' },
  { key: '{{장소}}',  desc: '행사 장소' },
];

const CATEGORIES = ['입금 요청', '참가 확정', '미선발 안내', '선발 제안', '공지 / 이벤트', '기타'];

const panel = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  boxShadow: '0 4px 20px -1px rgba(0,0,0,0.03)',
};

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  createdAt?: any;
}

const DEFAULT_TEMPLATES: Omit<Template, 'id'>[] = [
  {
    name: '이상형 추천 제안',
    category: '선발 제안',
    content: `안녕하세요 키링크입니다 :)
다름이 아니라 {{날짜}} ({{요일}}) {{시간}} 에 남녀간 이상형에 부합되는 분들이 계시다고 판단되어 연락드렸습니다 !
참여 가능여부 알려주시면 감사하겠습니다

라인업은 실시간 현황에서 확인 가능하며 일찍 마감 될 수 있다는 점 미리 양해 부탁드립니다 :)`,
  },
  {
    name: '입금 요청 (기본)',
    category: '입금 요청',
    content: `안녕하세요 ! 키링크에 지원해주셔서 감사합니다 :)
{{이름}}님은 {{날짜}} ({{요일}}) {{시간}} 소개팅 날짜가 지정되었습니다

아래 계좌번호로 {{금액}}원 입금해주셔야 라인업에 확정등록되니 참고 부탁드립니다 :)
3333359229548 카카오뱅크 태영훈(키링크) 입금 또는 참석가능 여부 알려주세요
혹시나 입금이 늦을 것 같은 경우 말씀해주세요.

좋은 인연 만날 수 있도록 키링크가 끝까지 책임질게요`,
  },
  {
    name: '참가 확정 안내',
    category: '참가 확정',
    content: `안녕하세요 {{이름}}님! 키링크입니다.
입금이 확인되어 {{기수}} 참가가 최종 확정되었습니다.

일시: {{날짜}} ({{요일}}) {{시간}}
장소: {{장소}}

당일 현장에서 뵙겠습니다! 좋은 인연 만나시길 바랍니다 :)`,
  },
  {
    name: '미선발 안내',
    category: '미선발 안내',
    content: `안녕하세요 {{이름}}님, 키링크입니다.
아쉽게도 {{기수}} 라인업에 선발되지 못하셨습니다.

다음 기수에 우선 검토해드리겠습니다.
더 좋은 인연으로 만날 수 있도록 노력하겠습니다. 감사합니다.`,
  },
];

export default function SmsTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');

  const emptyForm = { name: '', category: '입금 요청', content: '' };
  const [form, setForm] = useState(emptyForm);

  // Firestore 실시간 연동
  useEffect(() => {
    const q = query(collection(db, 'smsTemplates'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
      setTemplates(docs);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // 기본 템플릿 시딩 (기존에 없는 것만 추가)
  const handleSeedDefaults = async () => {
    try {
      const existingNames = new Set(templates.map(t => t.name));
      const toAdd = DEFAULT_TEMPLATES.filter(t => !existingNames.has(t.name));
      
      if (toAdd.length === 0) {
        toast.success('이미 모든 기본 템플릿이 추가되어 있습니다.');
        return;
      }

      await Promise.all(
        toAdd.map(t =>
          addDoc(collection(db, 'smsTemplates'), { ...t, createdAt: serverTimestamp() })
        )
      );
      toast.success(`${toAdd.length}개의 새로운 기본 템플릿이 추가되었습니다.`);
    } catch {
      toast.error('기본 템플릿 추가에 실패했습니다.');
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error('템플릿 이름과 내용을 입력해주세요.');
      return;
    }
    try {
      await addDoc(collection(db, 'smsTemplates'), {
        ...form,
        createdAt: serverTimestamp(),
      });
      toast.success('템플릿이 저장되었습니다.');
      setForm(emptyForm);
      setIsCreating(false);
    } catch {
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error('템플릿 이름과 내용을 입력해주세요.');
      return;
    }
    try {
      await updateDoc(doc(db, 'smsTemplates', id), {
        name: form.name,
        category: form.category,
        content: form.content,
      });
      toast.success('템플릿이 수정되었습니다.');
      setEditingId(null);
    } catch {
      toast.error('수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'smsTemplates', id));
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({ name: t.name, category: t.category, content: t.content });
    setIsCreating(false);
  };

  const insertVariable = (varKey: string) => {
    setForm(f => ({ ...f, content: f.content + varKey }));
  };

  const filteredTemplates = selectedCategory === '전체'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-[#FF7E7E]" size={28} />
        <p className="text-slate-400 font-medium text-sm">템플릿 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0F172A' }}>
            SMS 템플릿 관리
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {templates.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              className="flex items-center gap-2 rounded-xl h-10 px-4 border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
            >
              기본 템플릿 추가
            </button>
          )}
          <button
            onClick={() => { setIsCreating(true); setEditingId(null); setForm(emptyForm); }}
            className="flex items-center gap-2 rounded-xl h-10 px-5 bg-[#FF7E7E] text-white font-bold text-sm shadow-lg shadow-[#FF7E7E]/30 hover:opacity-90 transition-all"
          >
            <Plus size={16} /> 새 템플릿
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 템플릿 목록 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 카테고리 필터 */}
          <div className="flex flex-wrap gap-2">
            {['전체', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#FF7E7E] text-white shadow-md shadow-[#FF7E7E]/30'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 새 템플릿 생성 폼 */}
          {isCreating && (
            <TemplateForm
              form={form}
              setForm={setForm}
              onSave={handleCreate}
              onCancel={() => setIsCreating(false)}
              onInsertVariable={insertVariable}
              title="새 템플릿 작성"
            />
          )}

          {/* 템플릿 리스트 */}
          {filteredTemplates.length === 0 && !isCreating ? (
            <div style={panel} className="flex flex-col items-center justify-center py-16 gap-4">
              <MessageSquare size={36} className="text-slate-200" />
              <p className="text-slate-400 font-bold text-sm">
                {selectedCategory === '전체' ? '저장된 템플릿이 없습니다.' : `${selectedCategory} 카테고리에 템플릿이 없습니다.`}
              </p>
            </div>
          ) : (
            filteredTemplates.map(t => (
              <div key={t.id} style={panel} className="overflow-hidden">
                {editingId === t.id ? (
                  <div className="p-6">
                    <TemplateForm
                      form={form}
                      setForm={setForm}
                      onSave={() => handleUpdate(t.id)}
                      onCancel={() => setEditingId(null)}
                      onInsertVariable={insertVariable}
                      title="템플릿 수정"
                    />
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-800">{t.name}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FF7E7E]/10 text-[#FF7E7E]">
                          {t.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { navigator.clipboard.writeText(t.content); toast.success('복사되었습니다.'); }}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                          title="내용 복사"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => startEdit(t)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl p-4 max-h-48 overflow-y-auto">
                      {t.content}
                    </pre>
                    <p className="text-xs text-slate-300 mt-3 font-medium">{t.content.length}자</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right: 변수 가이드 */}
        <div className="space-y-4">
          <div style={panel} className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info size={16} className="text-[#FF7E7E]" />
              <h3 className="text-sm font-black text-slate-800">사용 가능한 변수</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              아래 변수를 템플릿에 입력하면 문자 발송 시 실제 데이터로 자동 치환됩니다.
            </p>
            <div className="space-y-2">
              {VARIABLES.map(v => (
                <div key={v.key} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <code className="text-xs font-black text-[#FF7E7E]">{v.key}</code>
                    <p className="text-[10px] text-slate-400 mt-0.5">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={panel} className="p-6">
            <h3 className="text-sm font-black text-slate-800 mb-3">이모티콘 주의사항</h3>
            <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
              <p>⚠️ <b className="text-slate-600">이모티콘 포함 시</b> 일부 기기에서 깨져 보일 수 있습니다.</p>
              <p>✅ LMS(장문)로 발송되는 경우 대부분 지원되지만, 수신자 기기에 따라 다를 수 있습니다.</p>
              <p>💡 안전한 발송을 원하신다면 이모티콘 대신 <b>:)</b>, <b>^-^</b> 같은 텍스트 표현을 권장합니다.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateForm({
  form, setForm, onSave, onCancel, onInsertVariable, title,
}: {
  form: { name: string; category: string; content: string };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => void;
  onCancel: () => void;
  onInsertVariable: (v: string) => void;
  title: string;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-black text-slate-700">{title}</h4>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="템플릿 이름"
          value={form.name}
          onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
          className="col-span-2 md:col-span-1 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-[#FF7E7E]/20 focus:border-[#FF7E7E] outline-none"
        />
        <select
          value={form.category}
          onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-[#FF7E7E]/20 focus:border-[#FF7E7E] outline-none bg-white"
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* 변수 빠른 삽입 */}
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES.map(v => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsertVariable(v.key)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FF7E7E]/10 text-[#FF7E7E] hover:bg-[#FF7E7E]/20 transition-all"
          >
            {v.key}
          </button>
        ))}
      </div>

      <textarea
        rows={8}
        placeholder="문자 내용을 입력하세요..."
        value={form.content}
        onChange={e => setForm((f: any) => ({ ...f, content: e.target.value }))}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 font-medium resize-none focus:ring-2 focus:ring-[#FF7E7E]/20 focus:border-[#FF7E7E] outline-none leading-relaxed"
      />
      <p className="text-xs text-slate-400 -mt-2">{form.content.length}자</p>

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-100 transition-all"
        >
          <X size={14} /> 취소
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#FF7E7E] text-white text-sm font-black shadow-md shadow-[#FF7E7E]/25 hover:opacity-90 transition-all"
        >
          <Check size={14} /> 저장
        </button>
      </div>
    </div>
  );
}
