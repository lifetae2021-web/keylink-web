"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, Users } from "lucide-react";
import { getAllSessions } from "@/lib/firestore/sessions";
import { Session } from "@/lib/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function AllSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAllSessions()
      .then((data) => {
        setSessions(data.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime()));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const getBadge = (ev: Session) => {
    const now = new Date();
    const twoHoursAfter = new Date(ev.eventDate.getTime() + 2 * 60 * 60 * 1000);
    const currentMale = ev.currentMale || 0;
    const currentFemale = ev.currentFemale || 0;
    const isFull =
      (ev.maxMale > 0 && currentMale >= ev.maxMale) &&
      (ev.maxFemale > 0 && currentFemale >= ev.maxFemale);

    if (now >= twoHoursAfter) return { label: '종료', cls: 'bg-slate-100 text-slate-500' };
    if (now >= ev.eventDate) return { label: '진행 중', cls: 'bg-blue-100 text-blue-700' };
    if (isFull) return { label: '마감', cls: 'bg-red-100 text-red-600' };
    return { label: '모집 중', cls: 'bg-emerald-100 text-emerald-700' };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">전체 기수 목록</h1>
            <p className="text-sm text-slate-400">총 {sessions.length}개 기수</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20 text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((ev) => {
              const badge = getBadge(ev);
              const currentMale = ev.currentMale || 0;
              const currentFemale = ev.currentFemale || 0;

              return (
                <button
                  key={ev.id}
                  onClick={() => router.push(`/admin/events?session=${ev.id}`)}
                  className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        {ev.region === 'busan' ? '부산' : '창원'} {ev.episodeNumber}기
                      </span>
                      <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <Users size={12} />
                      <span>남 {currentMale}/{ev.maxMale} · 여 {currentFemale}/{ev.maxFemale}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>{format(ev.eventDate, 'yyyy.MM.dd (E) HH:mm', { locale: ko })}</span>
                    </div>
                    {ev.venue && (
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        <span>{ev.venue}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
