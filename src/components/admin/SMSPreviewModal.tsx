import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, User, Calendar, MapPin, CreditCard, ChevronDown, Pencil, Save, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';

interface SMSPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string, updatedPrice?: number) => Promise<void>;
  applicant: any;
  session: any;
  defaultMessage: string;
  recipientLabel?: string;
  confirmLabel?: string;
  autoSelectTemplateName?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
}

// 변수 치환 함수
function applyVariables(content: string, applicant: any, session: any, customPrice?: number): string {
  const eventTime = session?.eventDate?.toDate?.() ?? new Date();
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(eventTime);
  const getPart = (t: string) => parts.find(p => p.type === t)?.value ?? '';

  const genderPrice = applicant?.gender === 'male'
    ? (applicant?.maleOption === 'safe' ? 60000 : (session?.malePrice || 49000))
    : (applicant?.femaleOption === 'group' ? 24000 : (session?.femalePrice || 29000));

  const sessionName = session?.episodeNumber
    ? `${session?.region === 'busan' ? '부산' : '창원'} ${session?.episodeNumber}기`
    : '';

  // {{남은일수}} 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDateOnly = new Date(eventTime);
  eventDateOnly.setHours(0, 0, 0, 0);
  const diffTime = eventDateOnly.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const remainingDays = diffDays > 0 ? String(diffDays) : '0';

  // 쿠폰 할인 로직: couponDiscount 필드 기반 최종 금액과 할인 사유 계산
  const finalPrice = customPrice !== undefined ? customPrice : (applicant?.price || genderPrice);
  const couponDiscount = applicant?.couponDiscount && applicant.couponDiscount > 0 ? applicant.couponDiscount : 0;
  const isGroupDiscount = applicant?.gender === 'female' && applicant?.femaleOption === 'group';
  const discountSuffix = couponDiscount > 0
    ? ` (할인쿠폰 적용, ${couponDiscount.toLocaleString('ko-KR')}원 할인)`
    : (isGroupDiscount ? ' (동반할인 적용)' : '');
  const formattedPrice = `${finalPrice.toLocaleString('ko-KR')}원${discountSuffix}`;

  const openChatLink = session?.openChatLink || '';
  let result = content
    .replace(/{{이름}}/g, applicant?.name || applicant?.userName || '참가자')
    .replace(/{{날짜}}/g, `${getPart('month')}/${getPart('day')}`)
    .replace(/{{요일}}/g, getPart('weekday'))
    .replace(/{{시간}}/g, `${getPart('hour')}:${getPart('minute')}`)
    .replace(/{{기수}}/g, sessionName)
    .replace(/{{장소}}/g, session?.venue || session?.location || '')
    .replace(/{{남은일수}}/g, remainingDays)
    .replace(/{{오픈채팅링크}}/g, openChatLink);

  // v9.1.0: 하드코딩된 구버전 124기 링크가 들어있을 경우에도 신규 링크로 스마트 대체
  if (openChatLink) {
    result = result.replace(/https:\/\/open\.kakao\.com\/o\/gi30oUui/g, openChatLink);
  }

  if (result.includes('{{쿠폰적용여부}}')) {
    // 구버전 호환: {{쿠폰적용여부}} 사용 시 절러주기
    const couponText = couponDiscount > 0 ? ' (쿠폰 할인 적용)' : (isGroupDiscount ? ' (동반할인 적용)' : '');
    result = result
      .replace(/{{금액}}원/g, finalPrice.toLocaleString('ko-KR') + '원')
      .replace(/{{금액}}/g, finalPrice.toLocaleString('ko-KR'))
      .replace(/{{쿠폰적용여부}}/g, couponText);
  } else {
    result = result
      .replace(/{{금액}}원/g, formattedPrice)
      .replace(/{{금액}}/g, formattedPrice);
  }

  return result;
}

const SMSPreviewModal: React.FC<SMSPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  applicant,
  session,
  defaultMessage,
  recipientLabel,
  confirmLabel,
  autoSelectTemplateName,
}) => {
  const [message, setMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // 가격 수정 상태
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [lastPriceString, setLastPriceString] = useState<string>('');

  // 템플릿 수정 상태
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editForm, setEditForm] = useState({ name: '', content: '' });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [solapiBalance, setSolapiBalance] = useState<number | null>(null);
  const [solapiPoint, setSolapiPoint] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (applicant) {
        const gp = applicant.gender === 'male'
          ? (applicant.maleOption === 'safe' ? 60000 : (session?.malePrice || 49000))
          : (applicant.femaleOption === 'group' ? 24000 : (session?.femalePrice || 29000));
        const initialPrice = applicant.price || gp;
        setCurrentPrice(initialPrice);

        const couponDiscount = applicant.couponDiscount && applicant.couponDiscount > 0 ? applicant.couponDiscount : 0;
        const isGroupDiscount = applicant.gender === 'female' && applicant.femaleOption === 'group';
        const discountSuffix = couponDiscount > 0
          ? ` (할인쿠폰 적용, ${couponDiscount.toLocaleString('ko-KR')}원 할인)`
          : (isGroupDiscount ? ' (동반할인 적용)' : '');
        const initialPriceString = `${initialPrice.toLocaleString('ko-KR')}원${discountSuffix}`;
        setLastPriceString(initialPriceString);

        const applied = applyVariables(defaultMessage, applicant, session, initialPrice);
        setMessage(applied);
      } else {
        setCurrentPrice(0);
        setLastPriceString('');
        setMessage(defaultMessage);
      }

      fetch('/api/admin/solapi/balance')
        .then(res => res.json())
        .then(data => {
          console.log('[Solapi Balance Response]', data);
          if (data.success) {
            setSolapiBalance(data.balance ?? 0);
            setSolapiPoint(data.point ?? 0);
          }
        })
        .catch(console.error);
    }
  }, [defaultMessage, isOpen, applicant, session]);

  const handlePriceChange = (newPrice: number) => {
    setCurrentPrice(newPrice);

    if (applicant) {
      const couponDiscount = applicant.couponDiscount && applicant.couponDiscount > 0 ? applicant.couponDiscount : 0;
      const isGroupDiscount = applicant.gender === 'female' && applicant.femaleOption === 'group';
      const discountSuffix = couponDiscount > 0
        ? ` (할인쿠폰 적용, ${couponDiscount.toLocaleString('ko-KR')}원 할인)`
        : (isGroupDiscount ? ' (동반할인 적용)' : '');
      const newPriceString = `${newPrice.toLocaleString('ko-KR')}원${discountSuffix}`;

      if (lastPriceString && message.includes(lastPriceString)) {
        setMessage(prev => prev.replace(lastPriceString, newPriceString));
      }
      setLastPriceString(newPriceString);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const q = query(collection(db, 'smsTemplates'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
      setTemplates(fetched);

      // 자동 선택 로직 (v8.13.0)
      if (autoSelectTemplateName) {
        const target = fetched.find(t => t.name.includes(autoSelectTemplateName));
        if (target) {
          const gp = applicant?.gender === 'male'
            ? (applicant?.maleOption === 'safe' ? 60000 : (session?.malePrice || 49000))
            : (applicant?.femaleOption === 'group' ? 24000 : (session?.femalePrice || 29000));
          const initialPrice = applicant?.price || gp;

          const applied = applyVariables(target.content, applicant, session, initialPrice);
          setMessage(applied);

          const couponDiscount = applicant?.couponDiscount && applicant?.couponDiscount > 0 ? applicant.couponDiscount : 0;
          const isGroupDiscount = applicant?.gender === 'female' && applicant?.femaleOption === 'group';
          const discountSuffix = couponDiscount > 0
            ? ` (할인쿠폰 적용, ${couponDiscount.toLocaleString('ko-KR')}원 할인)`
            : (isGroupDiscount ? ' (동반할인 적용)' : '');
          const initialPriceString = `${initialPrice.toLocaleString('ko-KR')}원${discountSuffix}`;
          setLastPriceString(initialPriceString);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // 템플릿 목록 로드 (모달 열릴 때)
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, autoSelectTemplateName, applicant, session]);

  const handleSelectTemplate = (t: Template) => {
    const applied = applyVariables(t.content, applicant, session, currentPrice);
    setMessage(applied);

    if (applicant) {
      const couponDiscount = applicant.couponDiscount && applicant.couponDiscount > 0 ? applicant.couponDiscount : 0;
      const isGroupDiscount = applicant.gender === 'female' && applicant.femaleOption === 'group';
      const discountSuffix = couponDiscount > 0
        ? ` (할인쿠폰 적용, ${couponDiscount.toLocaleString('ko-KR')}원 할인)`
        : (isGroupDiscount ? ' (동반할인 적용)' : '');
      const currentPriceString = `${currentPrice.toLocaleString('ko-KR')}원${discountSuffix}`;
      setLastPriceString(currentPriceString);
    }

    setTemplateOpen(false);
    toast.success(`"${t.name}" 템플릿이 적용되었습니다.`);
  };

  const handleStartEdit = (e: React.MouseEvent, t: Template) => {
    e.stopPropagation();
    setEditingTemplate(t);
    setEditForm({ name: t.name, content: t.content });
    setTemplateOpen(false);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    if (!editForm.name.trim() || !editForm.content.trim()) {
      return toast.error('템플릿 이름과 내용을 입력해주세요.');
    }

    setIsSavingTemplate(true);
    try {
      await updateDoc(doc(db, 'smsTemplates', editingTemplate.id), {
        name: editForm.name,
        content: editForm.content
      });
      toast.success('템플릿이 수정되었습니다.');
      setEditingTemplate(null);
      fetchTemplates();
    } catch (e) {
      console.error(e);
      toast.error('템플릿 수정에 실패했습니다.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      await onConfirm(message, currentPrice);
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || '문자 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  // 이모티콘 감지
  const hasEmoji = /[\u{1F300}-\u{1FFFF}]/u.test(message);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF7E7E] to-[#FFAB91] px-6 py-5 md:px-8 md:py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">SMS 발송 미리보기</h3>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Manual Selection Process</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center text-white hover:bg-black/20 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 md:p-8 overflow-y-auto flex-1">
          {/* 템플릿 선택 버튼 */}
          <div className="mb-5 relative">
            <button
              onClick={() => {
                if (editingTemplate) setEditingTemplate(null);
                setTemplateOpen(v => !v);
              }}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all text-sm font-bold text-slate-600"
            >
              <span className="flex items-center gap-2">
                <MessageSquare size={15} className="text-[#FF7E7E]" />
                {editingTemplate ? '템플릿 수정 중...' : '저장된 템플릿 선택'}
              </span>
              <ChevronDown size={15} className={`transition-transform ${templateOpen ? 'rotate-180' : ''}`} />
            </button>

            {templateOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                {loadingTemplates ? (
                  <p className="text-center text-xs text-slate-400 py-6">로딩 중...</p>
                ) : templates.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">저장된 템플릿이 없습니다.</p>
                ) : (
                  templates.map(t => (
                    <div
                      key={t.id}
                      className="group/item flex items-stretch border-b border-slate-50 last:border-0"
                    >
                      <button
                        onClick={() => handleSelectTemplate(t)}
                        className="flex-1 text-left px-5 py-3.5 hover:bg-[#FF7E7E]/5 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-700">{t.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF7E7E]/10 text-[#FF7E7E]">{t.category}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{t.content.substring(0, 60)}...</p>
                      </button>
                      <button
                        onClick={(e) => handleStartEdit(e, t)}
                        className="px-4 text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all border-l border-slate-50"
                        title="템플릿 수정"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {editingTemplate ? (
            <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-blue-600 flex items-center gap-2">
                  <Pencil size={14} /> 템플릿 수정하기
                </h4>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                >
                  취소
                </button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="템플릿 이름"
                />
                <textarea
                  value={editForm.content}
                  onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full h-40 px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  placeholder="템플릿 내용 ({{이름}}, {{날짜}} 등 변수 사용 가능)"
                />
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSavingTemplate}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingTemplate ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  수정사항 저장하기
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
              {/* Left Side: Info */}
              <div className="md:col-span-2 space-y-6">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Receiver</h4>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#FF7E7E]">
                      <User size={20} />
                    </div>
                    <div className="truncate">
                      {recipientLabel ? (
                        <p className="text-sm font-black text-slate-800 truncate">{recipientLabel}</p>
                      ) : (
                        <>
                          <p className="text-sm font-black text-slate-800 truncate">{applicant?.name}님</p>
                          <p className="text-[10px] font-bold text-slate-500 tracking-tight">{applicant?.phone || '번호 없음'}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Session</h4>
                  <div className="bg-slate-50/50 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Calendar size={14} className="text-[#FF7E7E]" />
                      <span className="text-xs font-bold truncate">{session?.title || '기수 정보 없음'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <MapPin size={14} className="text-[#FF7E7E]" />
                      <span className="text-xs font-bold truncate">{session?.venue || session?.location || '장소 미정'}</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-600">
                      <CreditCard size={14} className="text-[#FF7E7E] mt-1 shrink-0" />
                      {applicant ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center bg-[#F8FAFC] hover:bg-[#F1F5F9]/60 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-[#FF7E7E] focus-within:ring-2 focus-within:ring-[#FF7E7E]/10 transition-all w-fit shadow-sm">
                              <input
                                type="text"
                                value={currentPrice === 0 ? '' : currentPrice.toLocaleString('ko-KR')}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                  handlePriceChange(val);
                                }}
                                className="w-24 text-xs font-black text-slate-700 bg-transparent border-0 outline-none p-0 text-right pr-1"
                                placeholder="0"
                              />
                              <span className="text-xs font-bold text-slate-400 select-none">원</span>
                            </div>
                          </div>
                          {applicant.couponDiscount && applicant.couponDiscount > 0 ? (
                            <span className="text-[0.55rem] font-bold text-purple-500 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded w-fit mt-0.5">
                              할인쿠폰 적용 (-{applicant.couponDiscount.toLocaleString('ko-KR')}원)
                            </span>
                          ) : null}
                          {applicant.gender === 'female' && applicant.femaleOption === 'group' ? (
                            <span className="text-[0.55rem] font-bold text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded w-fit mt-0.5">
                              동반할인 적용
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs font-bold">금액 정보 없음</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Solapi Status</h4>
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">잔액 (현금)</span>
                      {solapiBalance !== null ? (
                        <span className="text-sm font-black text-blue-600">{solapiBalance.toLocaleString()}원</span>
                      ) : (
                        <span className="text-xs text-slate-400 animate-pulse">조회 중...</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">포인트</span>
                      {solapiPoint !== null ? (
                        <span className="text-xs font-bold text-emerald-600">{solapiPoint.toLocaleString()}원</span>
                      ) : (
                        <span className="text-xs text-slate-400 animate-pulse">조회 중...</span>
                      )}
                    </div>
                    {solapiBalance !== null && solapiPoint !== null && (
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-xs font-black text-slate-600">합계</span>
                        <span className="text-sm font-black text-indigo-600">{(solapiBalance + solapiPoint).toLocaleString()}원</span>
                      </div>
                    )}
                  </div>
                </div>

                {!confirmLabel && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100/50">
                    <p className="text-[10px] font-semibold text-blue-600/80 leading-relaxed">
                      💡 발송 버튼을 누르면 상태가 <b className="text-blue-700">'선발(입금 대기)'</b>로 변경되며 수정한 메시지가 솔라피를 통해 즉시 발송됩니다.
                    </p>
                  </div>
                )}

                {/* 이모티콘 경고 */}
                {hasEmoji && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-600 leading-relaxed">
                      ⚠️ 메시지에 이모티콘이 포함되어 있습니다. 일부 기기에서 깨져 보일 수 있습니다.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Side: Editor */}
              <div className="md:col-span-3">
                <div className="flex flex-col h-full bg-slate-900 rounded-[28px] overflow-hidden shadow-xl border border-slate-800 min-h-[320px]">
                  <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Message Body</span>
                    <span className={`text-[10px] font-black ${message.length > 200 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {message.length} / 500
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 bg-transparent text-slate-200 text-sm p-6 resize-none outline-none font-medium leading-relaxed scrollbar-hide"
                    placeholder="메시지 내용을 입력하세요..."
                  />
                  <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800 text-[10px] font-bold text-slate-600">
                    Nurigo v4 Standard Signature Applied
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-10 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
            >
              취소
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !!editingTemplate}
              className="px-10 py-4 rounded-2xl bg-[#FF7E7E] text-white text-sm font-black shadow-xl shadow-[#FF7E7E]/25 hover:bg-[#FF6F61] transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {confirmLabel ?? '메시지 발송'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMSPreviewModal;
