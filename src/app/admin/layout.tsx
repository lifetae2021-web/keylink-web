'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import {
  BarChart3, Users, Calendar,
  LogOut, ShieldCheck, Menu, X, Bell, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

const menuItems = [
  { name: 'Dashboard', icon: BarChart3, path: '/admin' },
  { name: '신청자 관리', icon: Users, path: '/admin/users', badge: 12 },
  { name: '행사/매칭 관리', icon: Calendar, path: '/admin/events' },
  { name: '환경 설정', icon: ShieldCheck, path: '/admin/settings' },
];

const breadcrumbMap: Record<string, string> = {
  '/admin': '대시보드',
  '/admin/users': '신청자 관리',
  '/admin/events': '행사/매칭 관리',
  '/admin/settings': '환경 설정',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === '/admin/login') return <>{children}</>;

  const pageTitle = breadcrumbMap[pathname] ?? '관리자';

  return (
    <div className="min-h-screen bg-[#0F1115] flex">

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-[#13161b] border-r border-gray-800/60
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-[#FF6F61] to-[#C878A0] flex items-center justify-center">
              <ShieldCheck size={15} className="text-white" />
            </div>
            <span className="font-extrabold text-white tracking-tight">Keylink</span>
            <span className="text-[10px] font-bold text-[#FF6F61] bg-[#FF6F61]/10 px-1.5 py-0.5 rounded-md">ADMIN</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative
                  ${isActive
                    ? 'bg-[#FF6F61]/10 text-[#FF6F61]'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/50'
                  }
                `}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#FF6F61] rounded-r-full" />
                )}
                <item.icon size={17} />
                <span className="text-sm font-semibold flex-1">{item.name}</span>
                {item.badge ? (
                  <span className="text-[10px] font-bold bg-[#FF6F61] text-white px-1.5 py-0.5 rounded-full min-w-4.5 text-center">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800/60">
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all"
          >
            <LogOut size={17} />
            <span className="text-sm font-semibold">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-16 bg-[#13161b]/80 backdrop-blur-md border-b border-gray-800/60 flex items-center px-5 gap-4 sticky top-0 z-40">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-white transition-colors"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-600">Admin</span>
            <ChevronRight size={13} className="text-gray-700" />
            <span className="text-white font-semibold">{pageTitle}</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button className="relative w-9 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 rounded-xl transition-all">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6F61] rounded-full border-2 border-[#13161b]" />
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-800">
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-[#FF6F61]/30 to-[#C878A0]/30 border border-[#FF6F61]/20 flex items-center justify-center text-[#FF6F61] font-bold text-sm">
                {auth.currentUser?.email?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-none">
                  {auth.currentUser?.email?.split('@')[0] ?? 'Admin'}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
