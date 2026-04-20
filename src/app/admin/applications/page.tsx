'use client';

import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle, Eye,
  Download, ShieldCheck, ChevronLeft, ChevronRight, Loader2,
  FileText, Users, CreditCard, Filter, Calendar, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { 
  collection, getDocs, doc, updateDoc, query, where, orderBy, Timestamp, getDoc 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const DEPOSIT_STATUS = {
  pending:   { label: '입금 대기', color: '#888', bg: 'rgba(255,255,255,0.05)' },
  confirmed: { label: '입금 확인', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
};

const APP_STATUS = {
  pending:  { label: '승인 대기', color: '#facc15', bg: 'rgba(250,204,21,0.1)'  },
  verified: { label: '승인 완료', color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  rejected: { label: '인증 반려', color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
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

  // 1. Fetch Events for selection
  useEffect(() => {
    async function fetchEvents() {
      try {
        const q = query(collection(db, 'events'), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        const fetchedEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEvents(fetchedEvents);
        if (fetchedEvents.length > 0) {
          setSelectedEventId(fetchedEvents[0].id);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('기수 목록을 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvents();
  }, []);

  // 2. Fetch Applications when event changes
  useEffect(() => {
    if (!selectedEventId) return;

    async function fetchApplications() {
      try {
        setIsDataLoading(true);
        const q = query(
          collection(db, 'applications'),
          where('eventId', '==', selectedEventId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const apps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch User details for joining
        const uids = Array.from(new Set(apps.map(a => a.userId)));
        const newUserMap = { ...userMap };
        let updated = false;

        for (const uid of uids) {
          if (!newUserMap[uid]) {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              newUserMap[uid] = uSnap.data();
              updated = true;
            }
          }
        }
        
        if (updated) setUserMap(newUserMap);
        setApplications(apps);
      } catch (error) {
        console.error('Error fetching applications:', error);
      } finally {
        setIsDataLoading(false);
      }
    }
    fetchApplications();
  }, [selectedEventId]);

  const updateDeposit = async (appId: string, status: 'pending' | 'confirmed') => {
    try {
      await updateDoc(doc(db, 'applications', appId), { depositStatus: status });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, depositStatus: status } : a));
      toast.success(status === 'confirmed' ? '입금 확인 처리가 완료되었습니다.' : '입금 대기 상태로 변경되었습니다.');
    } catch (e) {
      toast.error('상태 업데이트에 실패했습니다.');
    }
  };

  const updateAppStatus = async (appId: string, status: 'verified' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'applications', appId), { status });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
      toast.success(status === 'verified' ? '신청이 승인되었습니다.' : '신청이 반려되었습니다.');
    } catch (e) {
      toast.error('상태 업데이트에 실패했습니다.');
    }
  };

  const activeEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>기수별 신청 관리</h2>
          <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>기수별 신청자 현황, 입금 상태 및 승인을 관리합니다. <span className="text-[10px] opacity-30">v3.4.0</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="kl-input pl-9 pr-8"
              style={{ padding: '8px 36px 8px 36px', minWidth: '220px', fontSize: '0.85rem' }}
            >
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.region === 'busan' ? '부산' : '창원'} {ev.episode}기 {ev.title ? `- ${ev.title}` : ''}
                </option>
              ))}
              {isLoading && <option>로딩 중...</option>}
            </select>
          </div>
          <button className="kl-btn-outline" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Summary Info Header */}
      {activeEvent && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '전체 신청', value: applications.length, icon: Users, color: '#FF6F61' },
            { label: '입금 확인', value: applications.filter(a => a.depositStatus === 'confirmed').length, icon: CreditCard, color: '#60a5fa' },
            { label: '최종 승인', value: applications.filter(a => a.status === 'verified').length, icon: CheckCircle, color: '#4ade80' },
            { label: '정원 현황', value: `${(activeEvent.currentMale || 0) + (activeEvent.currentFemale || 0)} / ${(activeEvent.maxMale || 0) + (activeEvent.maxFemale || 0)}`, icon: Calendar, color: '#facc15' },
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

      {/* Main Content Table */}
      <div style={{ ...panel, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['신청자', '입금 상태', '승인 상태', '직장/정보', '신청/결제일', '관리'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 20px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#444',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isLoading || isDataLoading) ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td colSpan={6} style={{ padding: '16px 20px' }}>
                      <div className="flex gap-4">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-1/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '80px 20px', textAlign: 'center', color: '#555' }}>
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={42} className="opacity-10" />
                      <p style={{ fontSize: '0.85rem' }}>해당 기수에 아직 신청 내역이 없습니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const user = userMap[app.userId] || {};
                  const dStatus = DEPOSIT_STATUS[app.depositStatus as keyof typeof DEPOSIT_STATUS] || DEPOSIT_STATUS.pending;
                  const aStatus = APP_STATUS[app.status as keyof typeof APP_STATUS] || APP_STATUS.pending;

                  return (
                    <tr 
                      key={app.id} 
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} 
                      className="hover:bg-white/[0.01] transition-colors"
                    >
                      {/* User Column */}
                      <td style={{ padding: '14px 20px' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                            {user.gender === 'female' 
                              ? <span className="text-[18px]">👩</span> 
                              : <span className="text-[18px]">👨</span>
                            }
                          </div>
                          <div>
                            <p style={{ fontSize: '0.88rem', fontWeight: 700 }}>{user.name || '알 수 없음'}</p>
                            <p style={{ fontSize: '0.72rem', color: '#555' }}>{user.gender === 'male' ? '남성' : '여성'} · {user.age || (user.birthDate ? `${2026 - parseInt('19' + user.birthDate.substring(0, 2)) + 1}세` : '??세')}</p>
                          </div>
                        </div>
                      </td>
                      
                      {/* Deposit Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <button 
                          onClick={() => updateDeposit(app.id, app.depositStatus === 'confirmed' ? 'pending' : 'confirmed')}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                          style={{ background: dStatus.bg, border: `1px solid ${dStatus.color}20` }}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${app.depositStatus === 'confirmed' ? 'bg-blue-400' : 'bg-gray-500'}`} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: dStatus.color }}>{dStatus.label}</span>
                        </button>
                      </td>

                      {/* Approval Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                          background: aStatus.bg, color: aStatus.color,
                          border: `1px solid ${aStatus.color}20`
                        }}>
                          {aStatus.label}
                        </span>
                      </td>

                      {/* Job/Info */}
                      <td style={{ padding: '14px 20px' }}>
                        <p style={{ fontSize: '0.8rem', color: '#bbb' }} className="truncate max-w-[150px]">{user.workplace || '-'}</p>
                        <p style={{ fontSize: '0.68rem', color: '#555' }}>전화: {user.phone || '-'}</p>
                      </td>

                      {/* CreatedAt */}
                      <td style={{ padding: '14px 20px', fontSize: '0.72rem', color: '#555' }}>
                        {app.createdAt ? format(app.createdAt.toDate(), 'MM.dd HH:mm') : '-'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px' }}>
                        <div className="flex items-center gap-2">
                          {app.status !== 'verified' && (
                            <button 
                              onClick={() => updateAppStatus(app.id, 'verified')}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white"
                              title="승인"
                            >
                              <ShieldCheck size={16} />
                            </button>
                          )}
                          <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white" title="상세보기">
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => updateAppStatus(app.id, 'rejected')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                            title="반려"
                          >
                            <XCircle size={16} />
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
    </div>
  );
}
