'use client';

import { X } from 'lucide-react';
import AdminNotesSection from './AdminNotesSection';

export default function AdminNotesModal({ user, onClose }: { user: any; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">{user.name || '이름 없음'} 메모</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>
        <AdminNotesSection userId={user.uid || user.id} />
      </div>
    </div>
  );
}
