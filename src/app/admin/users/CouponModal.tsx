'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Clock, Ticket, Calendar, Gift } from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, addDoc, getDocs, query, orderBy, 
  Timestamp, serverTimestamp 
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface CouponModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function CouponModal({ user, isOpen, onClose }: CouponModalProps) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'list' | 'issue'>('list');

  // Issue Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'free' | 'discount'>('free');
  const [amount, setAmount] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState('');

  const fetchCoupons = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users', user.id, 'coupons'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchCoupons();
      setView('list');
    }
  }, [isOpen, user]);

  const issueCoupon = async () => {
    if (!title) return toast.error('쿠폰명을 입력해 주세요.');
    if (!expiryDate) return toast.error('만료일을 선택해 주세요.');

    try {
      setIsLoading(true);
      await addDoc(collection(db, 'users', user.id, 'coupons'), {
        title,
        type,
        amount: type === 'discount' ? amount : 0,
        expireAt: Timestamp.fromDate(new Date(expiryDate)),
        createdAt: serverTimestamp(),
        status: 'active',
        issuedBy: 'admin'
      });
      toast.success('쿠폰이 성공적으로 발급되었습니다.');
      fetchCoupons();
      setView('list');
      // Reset form
      setTitle('');
      setAmount(0);
      setExpiryDate('');
    } catch (err) {
      console.error(err);
      toast.error('쿠폰 발급 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-bottom border-white/5 bg-white/2">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Gift size={18} className="text-[#FF6F61]" />
              쿠폰 관리
            </h3>
            <p className="text-xs text-white/40 mt-0.5">{user?.name} 님에게 쿠폰을 발급하거나 관리합니다.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button 
            onClick={() => setView('list')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${view === 'list' ? 'text-[#FF6F61] border-b-2 border-[#FF6F61]' : 'text-white/40 hover:text-white'}`}
          >
            보유 목록
          </button>
          <button 
            onClick={() => setView('issue')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${view === 'issue' ? 'text-[#FF6F61] border-b-2 border-[#FF6F61]' : 'text-white/40 hover:text-white'}`}
          >
            쿠폰 발급
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {view === 'list' ? (
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-10"><Clock className="animate-spin text-white/20" /></div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-10 text-white/20 text-sm italic">보유 중인 쿠폰이 없습니다.</div>
              ) : (
                coupons.map(c => (
                  <div key={c.id} className="p-4 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{c.title}</div>
                      <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
                        <Calendar size={10} />
                        {c.expireAt?.seconds ? format(new Date(c.expireAt.seconds * 1000), 'yyyy-MM-dd') : '무제한'} 까지
                      </div>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20'}`}>
                      {c.status === 'active' ? '사용가능' : '사용완료'}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40">쿠폰명</label>
                <input 
                  type="text" 
                  placeholder="예: VIP 전용 무료 초대권" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#FF6F61]/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40">종류</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setType('free')}
                    className={`p-2.5 rounded-lg text-sm transition-all border ${type === 'free' ? 'bg-[#FF6F61]/10 border-[#FF6F61] text-[#FF6F61]' : 'bg-white/5 border-white/5 text-white/40'}`}
                  >
                    무료 참가권
                  </button>
                  <button 
                    onClick={() => setType('discount')}
                    className={`p-2.5 rounded-lg text-sm transition-all border ${type === 'discount' ? 'bg-[#FF6F61]/10 border-[#FF6F61] text-[#FF6F61]' : 'bg-white/5 border-white/5 text-white/40'}`}
                  >
                    할인권
                  </button>
                </div>
              </div>

              {type === 'discount' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2">
                  <label className="text-xs font-semibold text-white/40">할인 금액 (₩)</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={amount} 
                    onChange={e => setAmount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#FF6F61]/50 transition-colors"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40">만료일</label>
                <input 
                  type="date" 
                  value={expiryDate} 
                  onChange={e => setExpiryDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#FF6F61]/50 transition-colors"
                />
              </div>

              <button 
                onClick={issueCoupon}
                disabled={isLoading}
                className="w-full bg-[#FF6F61] hover:bg-[#FF6F61]/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl mt-4 transition-all shadow-lg shadow-[#FF6F61]/20 flex items-center justify-center gap-2"
              >
                {isLoading ? <Clock className="animate-spin" size={18} /> : <Ticket size={18} />}
                쿠폰 발급하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
