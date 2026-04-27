import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, User, Calendar, MapPin, CreditCard, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

interface SMSPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void>;
  applicant: any;
  session: any;
  defaultMessage: string;
  recipientLabel?: string;
  confirmLabel?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
}

// 변수 치환 함수
function applyVariables(content: string, applicant: any, session: any): string {
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

  return content
    .replace(/{{이름}}/g, applicant?.name || applicant?.userName || '참가자')
    .replace(/{{날짜}}/g, `${getPart('month')}/${getPart('day')}`)
    .replace(/{{요일}}/g, getPart('weekday'))
    .replace(/{{시간}}/g, `${getPart('hour')}:${getPart('minute')}`)
    .replace(/{{금액}}/g, (applicant?.price || genderPrice).toLocaleString('ko-KR'))
    .replace(/{{기수}}/g, sessionName)
    .replace(/{{장소}}/g, session?.venue || session?.location || '');
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
}) => {
  const [message, setMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMessage(defaultMessage);
    }
  }, [defaultMessage, isOpen]);

  // 템플릿 목록 로드 (모달 열릴 때)
  useEffect(() => {
    if (!isOpen) return;
    setLoadingTemplates(true);
    const q = query(collection(db, 'smsTemplates'), orderBy('createdAt', 'desc'));
    getDocs(q).then(snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
      setLoadingTemplates(false);
    });
  }, [isOpen]);

  const handleSelectTemplate = (t: Template) => {
    const applied = applyVariables(t.content, applicant, session);
    setMessage(applied);
    setTemplateOpen(false);
    toast.success(`"${t.name}" 템플릿이 적용되었습니다.`);
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      await onConfirm(message);
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
      <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF7E7E] to-[#FFAB91] px-8 py-6 flex items-center justify-between">
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

        <div className="p-8">
          {/* 템플릿 선택 버튼 */}
          <div className="mb-5 relative">
            <button
              onClick={() => setTemplateOpen(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all text-sm font-bold text-slate-600"
            >
              <span className="flex items-center gap-2">
                <MessageSquare size={15} className="text-[#FF7E7E]" />
                저장된 템플릿 선택
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
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className="w-full text-left px-5 py-3.5 hover:bg-[#FF7E7E]/5 border-b border-slate-50 last:border-0 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700">{t.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF7E7E]/10 text-[#FF7E7E]">{t.category}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{t.content.substring(0, 60)}...</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

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
                  <div className="flex items-center gap-3 text-slate-600">
                    <CreditCard size={14} className="text-[#FF7E7E]" />
                    <span className="text-xs font-bold">{(applicant?.price || session?.price || 60000).toLocaleString()}원</span>
                  </div>
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
              disabled={isSending}
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
