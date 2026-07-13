'use client';

import { X, History, MapPin, MonitorSmartphone, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useState, useEffect } from 'react';

interface VisitLogModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function VisitLogModal({ user, isOpen, onClose }: VisitLogModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const uid = user.uid || user.id;
        const q = query(
          collection(db, 'visitor_logs'),
          where('userId', '==', uid),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        const fetchedLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(fetchedLogs);
      } catch (error) {
        console.error('Error fetching visit logs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [isOpen, user]);

  if (!user || !isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            className="relative w-full max-w-md max-h-[85vh] overflow-hidden bg-white border border-slate-200 rounded-[2rem] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <History size={18} className="text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">
                    {user.name} 방문 기록
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">최근 50건</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto p-2 bg-slate-50/50 flex-1 kl-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-400 mt-3">기록을 불러오는 중...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MonitorSmartphone size={32} strokeWidth={1.5} className="text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-400">방문 기록이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => {
                    const date = log.timestamp?.toDate ? log.timestamp.toDate() : (log.timestamp ? new Date(log.timestamp) : new Date());
                    return (
                      <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2 hover:border-indigo-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Clock size={13} className="text-slate-400" />
                            <span className="text-[0.8rem] font-bold">
                              {format(date, 'yyyy.MM.dd HH:mm')}
                            </span>
                          </div>
                          {/* 배지 */}
                          <div className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                            {log.userAgent?.includes('Mobile') ? 'Mobile' : 'PC'}
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                          <MapPin size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                          <span className="text-xs font-bold text-slate-600 break-all leading-tight">
                            {log.path || '/'}
                          </span>
                        </div>
                        
                        {log.referrer && log.referrer !== '' && !log.referrer.includes(window?.location?.host) && (
                          <div className="text-[10px] text-slate-400 font-medium px-1 flex items-center gap-1">
                            <span className="text-slate-300">유입:</span>
                            <span className="truncate flex-1" title={log.referrer}>{log.referrer}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
