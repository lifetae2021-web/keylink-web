"use client";
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserPlus, ClipboardList, Zap, Clock, Bell } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      
      const safeDate = (d: any) => {
        if (!d) return new Date(0);
        if (d.toDate) return d.toDate();
        if (d instanceof Date) return d;
        if (typeof d === 'number' || typeof d === 'string') return new Date(d);
        return new Date(0);
      };
      
      const formatTimeAgo = (date: Date) => {
        if (date.getTime() === 0) return '시간 정보 없음';
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;
        if (diff < 60) return '방금 전';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
        return format(date, 'MM/dd');
      };

      try {
        const [usersSnap, appsSnap, privateSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(100))),
          getDocs(query(collection(db, 'applications'), orderBy('appliedAt', 'desc'), limit(100))),
          getDocs(query(collection(db, 'private_applications'), orderBy('appliedAt', 'desc'), limit(100)))
        ]);

        let notis: any[] = [];

        usersSnap.forEach(d => {
          const data = d.data();
          const isDummy = data.isDummy === true || d.id.startsWith('dummy') || d.id.startsWith('user_m_') || d.id.startsWith('user_f_');
          if (isDummy) return;

          const status = data.status || 'pending';
          if (status === 'pending') {
            const date = safeDate(data.createdAt);
            notis.push({
              id: d.id + '_join',
              type: 'user',
              text: `${data.name || '신규유저'}님이\n가입 승인을 대기 중입니다.`,
              date,
              time: formatTimeAgo(date),
              path: '/admin/users'
            });
          }
          if (data.isJobReviewed === false) {
            let date = safeDate(data.updatedAt) || safeDate(data.createdAt);
            if (data.user_logs && data.user_logs.length > 0) {
              const lastLog = data.user_logs[data.user_logs.length - 1];
              if (lastLog.changedAt) date = safeDate(lastLog.changedAt);
            }
            notis.push({
              id: d.id + '_update',
              type: 'user',
              text: `${data.name || '회원'}님이\n프로필 정보를 수정했습니다.`,
              date,
              time: formatTimeAgo(date),
              path: '/admin/users'
            });
          }
        });

        appsSnap.forEach(d => {
          const data = d.data();
          if ((data.status || 'applied') !== 'applied') return;
          const isDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true;
          if (isDummy) return;

          const date = safeDate(data.appliedAt);
          notis.push({
            id: d.id,
            type: 'app',
            text: `${data.name || '신청자'}님이\n새로운 로테이션 참가를 신청했습니다.`,
            date,
            time: formatTimeAgo(date),
            path: '/admin/applications'
          });
        });

        privateSnap.forEach(d => {
          const data = d.data();
          const status = data.status;
          if (status && status !== 'pending_consult' && status !== 'applied') return;
          const isDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true;
          if (isDummy) return;

          const date = safeDate(data.appliedAt);
          notis.push({
            id: d.id,
            type: 'private',
            text: `${data.name || '신청자'}님이\n1:1 프라이빗 매칭을 신청했습니다.`,
            date,
            time: formatTimeAgo(date),
            path: '/admin/applications'
          });
        });

        notis.sort((a, b) => b.date.getTime() - a.date.getTime());
        setNotifications(notis);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
          <Bell size={20} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">모든 알림</h1>
          <p className="text-sm text-slate-500 mt-1">새로운 신청 및 변경사항을 한 곳에서 확인하세요.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6F61] mr-3"></div>
            불러오는 중...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <Bell size={48} className="mb-4 text-slate-200" />
            <p className="font-medium text-slate-500 text-lg">새로운 알림이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <Link 
                key={n.id} 
                href={n.path}
                className="flex items-start gap-4 p-5 sm:p-6 hover:bg-slate-50 transition-colors group cursor-pointer block"
                style={{ textDecoration: 'none' }}
              >
                <div 
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-1 group-hover:scale-110 transition-transform"
                  style={{
                    background: n.type === 'user' ? '#EFF6FF' : n.type === 'app' ? '#F0FDF4' : '#FEF2F2',
                    color: n.type === 'user' ? '#3B82F6' : n.type === 'app' ? '#22C55E' : '#EF4444',
                  }}
                >
                  {n.type === 'user' ? <UserPlus size={18} /> : n.type === 'app' ? <ClipboardList size={18} /> : <Zap size={18} />}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[0.95rem] sm:text-[1rem] font-semibold text-slate-800 leading-relaxed group-hover:text-[#FF6F61] transition-colors break-keep whitespace-pre-line">
                    {n.text}
                  </p>
                  <p className="text-[0.8rem] text-slate-400 mt-1.5 flex items-center gap-1.5 font-medium">
                    <Clock size={12} /> {n.time}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
