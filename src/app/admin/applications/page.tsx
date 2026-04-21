'use client';

import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle, Eye,
  Download, ShieldCheck, ChevronLeft, ChevronRight, Loader2,
  FileText, Users, CreditCard, Filter, Calendar, MapPin,
  X, Phone, Briefcase, Ruler, Smile, Cigarette, Beer, Camera, Info, 
  Ticket
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { 
  collection, getDocs, doc, query, where, orderBy, Timestamp, getDoc, onSnapshot 
} from 'firebase/firestore';
import {
  selectApplicant,
  confirmPayment,
  cancelApplicant,
  restoreApplicant,
  holdApplicant,
} from '@/lib/admin/selection';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const DEPOSIT_STATUS = {
  pending:   { label: '입금 대기', color: '#888', bg: 'rgba(255,255,255,0.05)' },
  confirmed: { label: '입금 확인', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
};

const APP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  applied:   { label: '검토 중',   color: '#facc15', bg: 'rgba(250,204,21,0.1)'  },
  selected:  { label: '입금 대기', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  held:      { label: '보류',      color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  confirmed: { label: '참가 확정', color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  cancelled: { label: '취소',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 };

// Skeletons
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-white/5 rounded ${className}`} />
);

export default function ApplicationsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [applications, setApplications] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  // Filtering & Modal States
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
  const [filterUnselectedOnly, setFilterUnselectedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. sessions 컬렉션 실시간 동기화
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('eventDate', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const fetchedEvents = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setEvents(fetchedEvents);
      if (fetchedEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(fetchedEvents[0].id);
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching sessions:', err);
      toast.error('기수 목록을 불러오지 못했습니다.');
      setIsLoading(false);
    });
    return () => unsub();
  }, [selectedEventId]);

  // 2. 신청 내역 실시간 동기화
  useEffect(() => {
    if (!selectedEventId) return;

    setIsDataLoading(true);
    const q = query(
      collection(db, 'applications'),
      where('sessionId', '==', selectedEventId),
      orderBy('appliedAt', 'desc')
    );

    const unsub = onSnapshot(q, async (snap) => {
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setApplications(apps);
      
      // users 컬렉션에서 누락된 정보 조인
      const uids = Array.from(new Set(apps.map((a: any) => a.userId))) as string[];
      const newUserMap = { ...userMap };
      let updated = false;

      const missingUids = uids.filter(uid => !newUserMap[uid]);
      if (missingUids.length > 0) {
        for (const uid of missingUids) {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            newUserMap[uid] = uSnap.data();
            updated = true;
          }
        }
      }
      
      if (updated) setUserMap(newUserMap);
      setIsDataLoading(false);
    }, (err) => {
      console.error('Error fetching applications:', err);
      setIsDataLoading(false);
    });

    return () => unsub();
  }, [selectedEventId]);

  // status 변경 로직
  const updateAppStatus = async (app: any, status: string) => {
    try {
      const { id: appId, sessionId, gender, status: prevStatus } = app;
      
      if (status === 'selected') {
        await selectApplicant(appId);
      } else if (status === 'held') {
        await holdApplicant(appId);
      } else if (status === 'confirmed') {
        if (prevStatus === 'cancelled') {
          await restoreApplicant(appId, sessionId, gender);
        } else {
          await confirmPayment(appId, sessionId, gender);
        }
      } else if (status === 'cancelled') {
        await cancelApplicant(appId, sessionId, gender, prevStatus === 'confirmed');
      }

      const labels: Record<string, string> = { selected: '선발', confirmed: '참가 확정', cancelled: '취소', held: '보류' };
      toast.success(`${labels[status] || status} 처리 완료`);
      
    } catch (e) {
      console.error(e);
      toast.error('상태 업데이트에 실패했습니다.');
    }
  };

  const activeEvent = events.find(e => e.id === selectedEventId);

  // Quick Profile Modal Component
  const QuickProfileModal = ({ user, onClose }: { user: any, onClose: () => void }) => {
    if (!user) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#141417] border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${user.gender === 'male' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>
                {user.name ? user.name[0] : 'U'}
              </div>
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {user.name} 
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-normal">
                    {user.gender === 'male' ? '남성' : '여성'} · {user.birthDate ? `${new Date().getFullYear() - parseInt(user.birthDate.split('-')[0]) + 1}세` : '??세'}
                  </span>
                </h3>
                <p className="text-sm text-white/40">{user.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Photos & Intro */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-3">프로필 사진</h4>
                  <div className="aspect-[3/4] rounded-2xl bg-white/5 overflow-hidden border border-white/10">
                    {user.profilePhotos && user.profilePhotos.length > 0 ? (
                      <img src={user.profilePhotos[0]} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10 italic text-sm">등록된 사진 없음</div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-3">자기소개</h4>
                  <p className="text-sm leading-relaxed text-white/70 bg-white/5 p-4 rounded-2xl border border-white/5 whitespace-pre-wrap">
                    {user.aboutMe || user.intro || "입력된 자기소개가 없습니다."}
                  </p>
                </div>
              </div>

              {/* Right Column: Details */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white/20 uppercase tracking-widest">기본 정보</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <Briefcase size={16} className="text-[#FF6F61]" />
                      <div>
                        <p className="text-[10px] text-white/30 leading-none mb-1">직업</p>
                        <p className="text-sm font-medium">{user.workplace || user.job || "미입력"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <MapPin size={16} className="text-[#FF6F61]" />
                      <div>
                        <p className="text-[10px] text-white/30 leading-none mb-1">거주지</p>
                        <p className="text-sm font-medium">{user.residence || user.location || user.city || "미입력"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <Ruler size={16} className="text-[#FF6F61]" />
                      <div>
                        <p className="text-[10px] text-white/30 leading-none mb-1">키 / 몸무게</p>
                        <p className="text-sm font-medium">{user.height ? `${user.height}cm` : '??'} / {user.weight ? `${user.weight}kg` : '??'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <Phone size={16} className="text-[#FF6F61]" />
                      <div>
                        <p className="text-[10px] text-white/30 leading-none mb-1">연락처</p>
                        <p className="text-sm font-medium">{user.phone || "미입력"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white/20 uppercase tracking-widest">라이프스타일</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] text-white/30 mb-1 flex items-center gap-1"><Smile size={10}/> 종교</p>
                      <p className="text-sm font-medium">{user.religion || "미입력"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] text-white/30 mb-1 flex items-center gap-1"><Cigarette size={10}/> 흡연</p>
                      <p className="text-sm font-medium">{user.smoking || "미입력"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] text-white/30 mb-1 flex items-center gap-1"><Beer size={10}/> 음주</p>
                      <p className="text-sm font-medium">{user.drinking || "미입력"}</p>
                    </div>
                    {user.instagram && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <p className="text-[10px] text-white/30 mb-1 flex items-center gap-1"><Camera size={10}/> 인스타</p>
                        <p className="text-sm font-medium">@{user.instagram}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-white/5 flex gap-2">
            <button 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  };

  const filtered = applications.filter(app => {
    const user = userMap[app.userId] || {};
    const matchesSearch = 
      (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.workplace || user.job || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.residence || user.location || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = filterGender === 'all' || app.gender === filterGender;
    const matchesUnselected = !filterUnselectedOnly || app.status === 'applied';
    
    return matchesSearch && matchesGender && matchesUnselected;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>기수별 신청 관리</h2>
          <p style={{ fontSize: '0.85rem', color: '#555', marginTop: 2 }}>참가 신청자들의 상세 정보를 심사하고 선발 여부를 결정합니다. <span className="text-[10px] opacity-30">v5.4.0</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="kl-input pl-9 pr-10"
              style={{ width: '240px', height: '42px', fontSize: '0.88rem' }}
            >
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.episodeNumber}기 — {ev.title || ev.id}
                </option>
              ))}
            </select>
          </div>
          <button className="kl-btn-outline" style={{ height: '42px', padding: '0 16px', fontSize: '0.85rem' }}>
            <Download size={14} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* Summary Info Header */}
      {activeEvent && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '전체 신청',   value: applications.length,                                                         icon: Users,       color: '#FF6F61' },
            { label: '입금 대기',   value: applications.filter((a: any) => a.status === 'selected').length,              icon: CreditCard,  color: '#a78bfa' },
            { label: '참가 확정',   value: applications.filter((a: any) => a.status === 'confirmed').length,             icon: CheckCircle, color: '#4ade80' },
            { label: '정원 현황',  value: `${(activeEvent.currentMale||0)+(activeEvent.currentFemale||0)} / ${(activeEvent.maxMale||0)+(activeEvent.maxFemale||0)}`, icon: Calendar, color: '#facc15' },
          ].map((item, i) => (
            <div key={i} style={{ ...panel, padding: '16px 20px' }} className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: '0.75rem', color: '#555' }}>{item.label}</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: item.color, marginTop: 2 }}>{item.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}10` }}>
                <item.icon size={18} style={{ color: item.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ ...panel, padding: '12px 20px' }} className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            {[
              { id: 'all', label: '전체' },
              { id: 'male', label: '남성' },
              { id: 'female', label: '여성' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setFilterGender(t.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterGender === t.id ? 'bg-[#FF6F61] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setFilterUnselectedOnly(!filterUnselectedOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${filterUnselectedOnly ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-white/30 border-white/10'}`}
          >
            미선발만 보기
          </button>
        </div>

        <div className="relative w-full md:w-[320px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            placeholder="이름, 직업, 거주지로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-[#FF6F61]/50 transition-colors"
          />
        </div>
      </div>

      {/* Main Content Table */}
      <div style={{ ...panel, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '180px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '180px' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['참가자', '직업', '거주지', '키 / 몸무게', '라이프스타일', '연락처', '상태/결제', '선발 관리'].map((h, i) => (
                  <th key={h} style={{
                    padding: '16px 20px', textAlign: i === 7 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 600, color: '#444',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isDataLoading ? (
                [1,2,3,4,5,6,7,8].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '76px' }}>
                    <td colSpan={8} style={{ padding: '0 20px' }}><Skeleton className="h-10 w-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '100px 20px', textAlign: 'center', color: '#555' }}>
                    <div className="flex flex-col items-center gap-4">
                      <FileText size={48} className="opacity-10" />
                      <p style={{ fontSize: '0.9rem' }}>검색 결과와 일치하는 신청 내역이 없습니다.</p>
                      {(filterGender !== 'all' || filterUnselectedOnly || searchQuery) && (
                        <button onClick={() => { setFilterGender('all'); setFilterUnselectedOnly(false); setSearchQuery(''); }} className="text-[#FF6F61] text-xs font-bold underline">필터 초기화</button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((app) => {
                  const user = userMap[app.userId] || {};
                  const dStatus = DEPOSIT_STATUS[app.depositStatus as keyof typeof DEPOSIT_STATUS] || DEPOSIT_STATUS.pending;
                  const aStatus = APP_STATUS[app.status] || APP_STATUS['applied'];

                  return (
                    <tr 
                      key={app.id} 
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '76px' }} 
                      className="hover:bg-white/[0.015] transition-colors group cursor-default"
                    >
                      {/* 1. 참가자 */}
                      <td style={{ padding: '0 20px' }}>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                            className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 hover:border-[#FF6F61]/50 transition-colors"
                          >
                            {user.profilePhotos?.[0] ? <img src={user.profilePhotos[0]} className="w-full h-full object-cover" /> : <span className="text-xl">👤</span>}
                          </button>
                          <div className="truncate">
                            <button 
                              onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                              className="text-[0.92rem] font-bold block hover:text-[#FF6F61] transition-colors"
                            >
                              {user.name || '미입력'}
                            </button>
                            <span className={`text-[10px] font-bold ${user.gender === 'male' ? 'text-blue-400' : 'text-pink-400'}`}>
                              {user.gender === 'male' ? '남성' : '여성'} · {user.birthDate ? `${new Date().getFullYear() - parseInt(user.birthDate.split('-')[0]) + 1}세` : '??'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. 직업 */}
                      <td style={{ padding: '0 20px' }}>
                        <p className="text-[0.82rem] font-medium text-white/80 truncate">{user.workplace || user.job || '미입력'}</p>
                      </td>

                      {/* 3. 거주지 */}
                      <td style={{ padding: '0 20px' }}>
                        <p className="text-[0.82rem] text-white/60">{user.residence || user.location || user.city || '미입력'}</p>
                      </td>

                      {/* 4. 키/몸무게 */}
                      <td style={{ padding: '0 20px' }}>
                        <p className="text-[0.82rem] text-white/60">{user.height || '??'} / {user.weight || '??'}</p>
                      </td>

                      {/* 5. 라이프스타일 */}
                      <td style={{ padding: '0 20px' }}>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[0.7rem] text-white/40 flex items-center gap-1"><Smile size={10}/> {user.religion || '미입력'}</p>
                          <p className="text-[0.7rem] text-white/40 flex items-center gap-1"><Cigarette size={10}/> {user.smoking || '미입력'}</p>
                        </div>
                      </td>

                      {/* 6. 연락처 */}
                      <td style={{ padding: '0 20px' }}>
                        <p className="text-[0.82rem] text-white/70 font-mono tracking-tighter">{user.phone || '미입력'}</p>
                      </td>

                      {/* 7. 상태/결제 */}
                      <td style={{ padding: '0 20px' }}>
                        <div className="flex flex-col gap-1.5">
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, width: 'fit-content', background: aStatus.bg, color: aStatus.color }}>{aStatus.label}</span>
                          {app.paymentConfirmed ? (
                            <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1"><CheckCircle size={10}/> 입금완료</span>
                          ) : (
                            <span className="text-[10px] text-white/20 font-bold flex items-center gap-1"><Loader2 size={10}/> 입금대기</span>
                          )}
                        </div>
                      </td>

                      {/* 8. 선발 관리 */}
                      <td style={{ padding: '0 20px' }}>
                        <div className="flex items-center justify-end gap-1.5 transition-all">
                          {app.status === 'applied' && (
                            <>
                              <button onClick={() => updateAppStatus(app, 'selected')} className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-[#FF6F61]/10 text-[#FF6F61] border border-[#FF6F61]/20 hover:bg-[#FF6F61] hover:text-white transition-all">선발</button>
                              <button onClick={() => updateAppStatus(app, 'held')} className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500 hover:text-white transition-all">보류</button>
                            </>
                          )}
                          {app.status === 'selected' && (
                            <button onClick={() => updateAppStatus(app, 'confirmed')} className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white transition-all">입금확정</button>
                          )}
                          {app.status === 'held' && (
                            <button onClick={() => updateAppStatus(app, 'selected')} className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-[#FF6F61] text-white transition-all">선발전환</button>
                          )}
                          
                          <button 
                            onClick={() => {
                              if (window.confirm('정말 취소하시겠습니까? (확정된 참가자의 경우 정원 카운트도 줄어듭니다)')) {
                                updateAppStatus(app, app.status === 'cancelled' ? 'confirmed' : 'cancelled');
                              }
                            }} 
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${app.status === 'cancelled' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white'}`}
                          >
                            {app.status === 'cancelled' ? <span className="text-[0.7rem] font-bold">복구</span> : <XCircle size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && <QuickProfileModal user={selectedUser} onClose={() => { setIsModalOpen(false); setSelectedUser(null); }} />}
    </div>
  );
}
