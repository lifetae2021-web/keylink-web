import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, User, Calendar, MapPin, CreditCard } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      setMessage(defaultMessage);
    }
  }, [defaultMessage, isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    setIsSending(true);
    try {
      await onConfirm(message);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

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
                    💡 발송 버튼을 누르면 상태가 <b className="text-blue-700">'선발'</b>로 변경되며 수정한 메시지가 솔라피를 통해 즉시 발송됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* Right Side: Editor */}
            <div className="md:col-span-3">
              <div className="flex flex-col h-full bg-slate-900 rounded-[28px] overflow-hidden shadow-xl border border-slate-800 min-h-[320px]">
                <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Message Body</span>
                  <span className={`text-[10px] font-black ${message.length > 200 ? 'text-amber-400' : 'text-slate-500'}`}>{message.length} / 500</span>
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
              {confirmLabel ?? '메시지 발송 및 선발 완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMSPreviewModal;
