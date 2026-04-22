'use client';

import { useState, useEffect } from 'react';
import { 
  X, Plus, Clock, Ticket, Calendar, Gift, 
  Coins, History, ArrowUpRight, ArrowDownLeft, Trash2,
  AlertCircle, Loader2, ShieldCheck
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, addDoc, getDocs, query, orderBy, 
  Timestamp, serverTimestamp, doc, updateDoc,
  deleteDoc, increment
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface AssetModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssetModal({ user, isOpen, onClose }: AssetModalProps) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [pointLogs, setPointLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'coupons' | 'points'>('coupons');
  const [view, setView] = useState<'list' | 'action'>('list');

  // Coupon Issue State
  const [couponTitle, setCouponTitle] = useState('');
  const [couponType, setCouponType] = useState<'free' | 'discount'>('free');
  const [couponAmount, setCouponAmount] = useState<number>(0);
  const [couponExpiry, setCouponExpiry] = useState('');

  // Point Action State
  const [pointAmount, setPointAmount] = useState<number>(0);
  const [pointReason, setPointReason] = useState('');
  const [pointType, setPointType] = useState<'add' | 'subtract'>('add');

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      if (activeTab === 'coupons') {
        const q = query(collection(db, 'users', user.id, 'coupons'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        const q = query(collection(db, 'users', user.id, 'pointHistory'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setPointLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchData();
      setView('list');
    }
  }, [isOpen, user, activeTab]);

  // --- Coupon Logic ---
  const issueCoupon = async () => {
    if (!couponTitle) return toast.error('쿠폰명을 입력해 주세요.');
    if (!couponExpiry) return toast.error('만료일을 선택해 주세요.');

    try {
      setIsLoading(true);
      await addDoc(collection(db, 'users', user.id, 'coupons'), {
        title: couponTitle,
        type: couponType,
        amount: couponType === 'discount' ? couponAmount : 0,
        expireAt: Timestamp.fromDate(new Date(couponExpiry)),
        createdAt: serverTimestamp(),
        status: 'active',
        issuedBy: 'admin'
      });
      toast.success('쿠폰이 발급되었습니다.');
      fetchData();
      setView('list');
      setCouponTitle('');
      setCouponAmount(0);
      setCouponExpiry('');
    } catch (err) {
      console.error(err);
      toast.error('발급 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const revokeCoupon = async (couponId: string) => {
    if (!confirm('이 쿠폰을 정말로 회수하시겠습니까?')) return;
    try {
      setIsLoading(true);
      await deleteDoc(doc(db, 'users', user.id, 'coupons', couponId));
      toast.success('쿠폰이 회수되었습니다.');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('회수 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Point Logic ---
  const adjustPoints = async () => {
    if (pointAmount <= 0) return toast.error('금액을 입력해 주세요.');
    if (!pointReason) return toast.error('사유를 입력해 주세요.');

    const adjustment = pointType === 'add' ? pointAmount : -pointAmount;

    try {
      setIsLoading(true);
      const userRef = doc(db, 'users', user.id);
      
      // Update user balance
      await updateDoc(userRef, {
        points: increment(adjustment)
      });

      // Log to history
      await addDoc(collection(db, 'users', user.id, 'pointHistory'), {
        type: pointType,
        amount: pointAmount,
        reason: pointReason,
        createdAt: serverTimestamp(),
        adminId: 'admin'
      });

      toast.success(`포인트가 ${pointType === 'add' ? '지급' : '차감'}되었습니다.`);
      fetchData();
      setView('list');
      setPointAmount(0);
      setPointReason('');
    } catch (err) {
      console.error(err);
      toast.error('포인트 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF6F61]/10 flex items-center justify-center border border-[#FF6F61]/20">
                <ShieldCheck className="text-[#FF6F61]" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{user?.name} 관리</h3>
                <p className="text-[11px] text-white/30 uppercase tracking-widest mt-0.5">Asset Management</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-white/20 hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1.5 mx-6 mt-4 bg-white/5 rounded-2xl border border-white/5">
          <button 
            onClick={() => { setActiveTab('coupons'); setView('list'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'coupons' ? 'bg-[#FF6F61] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
          >
            <Ticket size={14} /> 쿠폰
          </button>
          <button 
            onClick={() => { setActiveTab('points'); setView('list'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'points' ? 'bg-[#FF6F61] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
          >
            <Coins size={14} /> 포인트
          </button>
        </div>

        {/* Action Toggle */}
        <div className="flex px-6 mt-4 justify-between items-center">
            <h4 className="text-[12px] font-bold text-white/60 tracking-tight">
                {activeTab === 'coupons' ? (view === 'list' ? '보유 쿠폰 목록' : '새 쿠폰 발급') : (view === 'list' ? '포인트 내역' : '포인트 조정')}
            </h4>
            <button 
                onClick={() => setView(view === 'list' ? 'action' : 'list')}
                className="text-[11px] font-bold text-[#FF6F61] hover:underline"
            >
                {view === 'list' ? (activeTab === 'coupons' ? '+ 신규 발급' : '+ 포인트 조정') : '목록으로 돌아가기'}
            </button>
        </div>

        {/* Content Area */}
        <div className="p-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {view === 'list' ? (
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="animate-spin text-[#FF6F61]/50" size={32} />
                    <span className="text-xs text-white/20 font-medium">데이터 로딩 중...</span>
                </div>
              ) : activeTab === 'coupons' ? (
                coupons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-white/10 opacity-50">
                    <History size={40} strokeWidth={1.5} />
                    <p className="text-[13px] mt-3 font-medium">보유 중인 쿠폰이 없습니다.</p>
                  </div>
                ) : (
                  coupons.map(c => (
                    <div key={c.id} className="group p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                            <Ticket size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{c.title}</div>
                          <div className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1.5">
                            <Calendar size={10} />
                            {c.expireAt?.seconds ? format(new Date(c.expireAt.seconds * 1000), 'yyyy-MM-dd') : '무제한'}
                            <span className="opacity-50">|</span>
                            {c.type === 'free' ? '무료 참가권' : `할인권 (₩${c.amount?.toLocaleString()})`}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => revokeCoupon(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-rose-500 transition-all hover:bg-rose-500/10 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )
              ) : (
                pointLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/10 opacity-50">
                        <History size={40} strokeWidth={1.5} />
                        <p className="text-[13px] mt-3 font-medium">포인트 내역이 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Current Balance Card */}
                        <div className="p-4 rounded-2xl bg-[#FF6F61]/5 border border-[#FF6F61]/10 flex items-center justify-between">
                            <span className="text-xs font-bold text-white/60">현재 잔액</span>
                            <span className="text-lg font-black text-[#FF6F61]">{user?.points?.toLocaleString() || 0} P</span>
                        </div>
                        <div className="space-y-2">
                           {pointLogs.map(log => (
                                <div key={log.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.type === 'add' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {log.type === 'add' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-bold text-white">{log.reason}</div>
                                            <div className="text-[10px] text-white/30 mt-0.5">
                                                {log.createdAt?.seconds ? format(new Date(log.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-[13px] font-black ${log.type === 'add' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {log.type === 'add' ? '+' : '-'}{log.amount?.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
              )}
            </div>
          ) : (
            <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
              {activeTab === 'coupons' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">쿠폰명</label>
                    <input 
                      type="text" 
                      placeholder="예: 신규 정회원 환영 참가권" 
                      value={couponTitle} 
                      onChange={e => setCouponTitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[13px] text-white outline-none focus:border-[#FF6F61]/50 transition-all placeholder:text-white/10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setCouponType('free')}
                        className={`py-3 rounded-2xl text-[13px] font-bold transition-all border ${couponType === 'free' ? 'bg-[#FF6F61]/10 border-[#FF6F61] text-[#FF6F61]' : 'bg-white/5 border-white/5 text-white/30'}`}
                    >
                        무료 참가권
                    </button>
                    <button 
                        onClick={() => setCouponType('discount')}
                        className={`py-3 rounded-2xl text-[13px] font-bold transition-all border ${couponType === 'discount' ? 'bg-[#FF6F61]/10 border-[#FF6F61] text-[#FF6F61]' : 'bg-white/5 border-white/5 text-white/30'}`}
                    >
                        할인권
                    </button>
                  </div>
                  {couponType === 'discount' && (
                    <div className="space-y-2 animate-in slide-in-from-top-1">
                        <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">할인 금액 (₩)</label>
                        <input 
                            type="number" 
                            placeholder="0" 
                            value={couponAmount} 
                            onChange={e => setCouponAmount(Number(e.target.value))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[13px] text-white outline-none focus:border-[#FF6F61]/50 transition-all"
                        />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">만료 일자</label>
                    <input 
                      type="date" 
                      value={couponExpiry} 
                      onChange={e => setCouponExpiry(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[13px] text-white outline-none focus:border-[#FF6F61]/50 transition-all"
                    />
                  </div>
                  <button 
                    onClick={issueCoupon}
                    disabled={isLoading}
                    className="w-full bg-[#FF6F61] hover:bg-[#FF8B7F] disabled:opacity-50 text-white font-black py-4 rounded-2xl mt-4 transition-all shadow-[0_12px_24px_rgba(255,111,97,0.3)] flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Ticket size={18} />}
                    쿠폰 발급 확정
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 p-1.4 bg-white/5 rounded-2xl border border-white/5">
                    <button 
                        onClick={() => setPointType('add')}
                        className={`py-3 rounded-xl text-[13px] font-bold transition-all ${pointType === 'add' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-white/20'}`}
                    >
                        지급 (+)
                    </button>
                    <button 
                        onClick={() => setPointType('subtract')}
                        className={`py-3 rounded-xl text-[13px] font-bold transition-all ${pointType === 'subtract' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-white/20'}`}
                    >
                        차감 (-)
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">조정 포인트 (P)</label>
                    <input 
                        type="number" 
                        placeholder="0" 
                        value={pointAmount} 
                        onChange={e => setPointAmount(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[13px] text-white outline-none focus:border-[#FF6F61]/50 transition-all font-black text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">조정 사유</label>
                    <textarea 
                      placeholder="회원에게 노출되는 사유를 입력하세요..." 
                      value={pointReason} 
                      onChange={e => setPointReason(e.target.value)}
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[13px] text-white outline-none focus:border-[#FF6F61]/50 transition-all resize-none placeholder:text-white/10"
                    />
                  </div>
                  <button 
                    onClick={adjustPoints}
                    disabled={isLoading}
                    className="w-full bg-[#FF6F61] hover:bg-[#FF8B7F] disabled:opacity-50 text-white font-black py-4 rounded-2xl mt-4 transition-all shadow-[0_12px_24px_rgba(255,111,97,0.3)] flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Coins size={18} />}
                    포인트 {pointType === 'add' ? '지급' : '차감'} 확정
                  </button>
                  <div className="px-2 flex items-start gap-2 opacity-40">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <p className="text-[10px] leading-relaxed font-medium">포인트 조정 내역은 회원 마이페이지 히스토리에 즉시 반영되며, 취소할 수 없습니다.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
