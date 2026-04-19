'use client';

import { useState } from 'react';
import { 
  Users, Search, Filter, CheckCircle, XCircle, 
  ExternalLink, Mail, Phone, ShieldCheck, 
  MoreHorizontal, ChevronLeft, ChevronRight,
  Eye, Download
} from 'lucide-react';
import toast from 'react-hot-toast';

// Mock Data for User Management
const mockUsers = [
  { id: 'u1', name: '김지민', gender: 'female', age: 27, job: '삼성전자 연구원', status: 'verified', joined: '2024-04-10', email: 'jimin@gmail.com' },
  { id: 'u2', name: '박준형', gender: 'male', age: 31, job: '네이버 개발자', status: 'pending', joined: '2024-04-15', email: 'junh@naver.com' },
  { id: 'u3', name: '이서윤', gender: 'female', age: 25, job: '초등학교 교사', status: 'pending', joined: '2024-04-16', email: 'syun@daum.net' },
  { id: 'u4', name: '최현우', gender: 'male', age: 29, job: '카카오 디자이너', status: 'verified', joined: '2024-04-12', email: 'hwoo@kakao.com' },
  { id: 'u5', name: '정다혜', gender: 'female', age: 28, job: '전문직(약사)', status: 'rejected', joined: '2024-04-08', email: 'dahye@gmail.com' },
  { id: 'u6', name: '오민석', gender: 'male', age: 33, job: '공무원', status: 'verified', joined: '2024-04-05', email: 'msoh@korea.kr' },
];

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.name.includes(searchTerm) || user.job.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = (name: string) => {
    toast.success(`${name} 회원의 신원인증이 승인되었습니다.`);
  };

  const handleReject = (name: string) => {
    toast.error(`${name} 회원의 신원인증이 거절되었습니다.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-[#6A98C8]" size={24} /> 신청자 및 회원 관리
          </h1>
          <p className="text-gray-400 text-sm mt-1">플랫폼 가입자 현황 및 신원인증 요청을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
            <Download size={16} /> 명단 다운로드 (CSV)
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="이름, 직업 또는 이메일 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0F1115] border border-gray-700 rounded-xl py-2.5 px-11 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6F61]/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="text-gray-500" size={18} />
          <div className="flex bg-[#0F1115] border border-gray-700 rounded-xl p-1">
            {['all', 'pending', 'verified', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterStatus === status 
                    ? 'bg-gray-800 text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {status === 'all' ? '전체' : status === 'pending' ? '승인대기' : status === 'verified' ? '인증완료' : '반려'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 border-b border-gray-800">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">회원정보</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">직업 / 나이</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">가입일</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold relative ${
                        user.gender === 'male' ? 'bg-[#6A98C8]/10 text-[#6A98C8]' : 'bg-[#FF6F61]/10 text-[#FF6F61]'
                      }`}>
                        {user.name[0]}
                        {user.status === 'verified' && (
                          <div className="absolute -bottom-1 -right-1 bg-[#1A1D23] rounded-full p-0.5">
                            <ShieldCheck size={14} className="text-[#6EAE7C]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white flex items-center gap-1.5">
                          {user.name}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${user.gender === 'male' ? 'bg-blue-500/10 text-blue-400' : 'bg-pink-500/10 text-pink-400'}`}>
                            {user.gender === 'male' ? 'M' : 'F'}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-200">{user.job}</p>
                    <p className="text-xs text-gray-500 mt-1">{user.age}세</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      user.status === 'verified' ? 'bg-green-500/10 text-green-400' : 
                      user.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 
                      'bg-red-500/10 text-red-400'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        user.status === 'verified' ? 'bg-green-400' : 
                        user.status === 'pending' ? 'bg-yellow-400' : 
                        'bg-red-400'
                      }`} />
                      {user.status === 'verified' ? '인증 완료' : user.status === 'pending' ? '승인 대기' : '인증 반려'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {user.joined}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {user.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleApprove(user.name)}
                            className="p-2 hover:bg-green-500/10 text-green-400 rounded-lg transition-colors"
                            title="승인"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => handleReject(user.name)}
                            className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                            title="거절"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                      <button className="p-2 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors">
                        <Eye size={18} />
                      </button>
                      <button className="p-2 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-900/30 px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-500">Showing <span className="text-white font-medium">1-6</span> of <span className="text-white font-medium">{mockUsers.length}</span> users</p>
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-gray-600 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
            <button className="w-8 h-8 rounded-lg bg-[#FF6F61] text-white text-xs font-bold">1</button>
            <button className="p-1.5 text-gray-600 hover:text-white transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
