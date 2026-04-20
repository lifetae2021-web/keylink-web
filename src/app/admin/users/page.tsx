'use client';

import { useState } from 'react';
import {
  Users, Search, Filter, CheckCircle, XCircle,
  ShieldCheck, Eye, Download, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const mockUsers = [
  { id: 'u1', name: '김지민', gender: 'female', age: 27, job: '삼성전자 연구원', status: 'verified', joined: '2024-04-10', email: 'jimin@gmail.com' },
  { id: 'u2', name: '박준형', gender: 'male', age: 31, job: '네이버 개발자', status: 'pending', joined: '2024-04-15', email: 'junh@naver.com' },
  { id: 'u3', name: '이서윤', gender: 'female', age: 25, job: '초등학교 교사', status: 'pending', joined: '2024-04-16', email: 'syun@daum.net' },
  { id: 'u4', name: '최현우', gender: 'male', age: 29, job: '카카오 디자이너', status: 'verified', joined: '2024-04-12', email: 'hwoo@kakao.com' },
  { id: 'u5', name: '정다혜', gender: 'female', age: 28, job: '전문직(약사)', status: 'rejected', joined: '2024-04-08', email: 'dahye@gmail.com' },
  { id: 'u6', name: '오민석', gender: 'male', age: 33, job: '공무원', status: 'verified', joined: '2024-04-05', email: 'msoh@korea.kr' },
];

type Status = 'all' | 'pending' | 'verified' | 'rejected';

const statusConfig = {
  verified: { label: '인증 완료', color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-400' },
  pending:  { label: '승인 대기', color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-400' },
  rejected: { label: '인증 반려', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' },
};

const filterTabs: { key: Status; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인 대기' },
  { key: 'verified', label: '인증 완료' },
  { key: 'rejected', label: '반려' },
];

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status>('all');

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.name.includes(searchTerm) || user.job.includes(searchTerm) || user.email.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: mockUsers.length,
    pending: mockUsers.filter(u => u.status === 'pending').length,
    verified: mockUsers.filter(u => u.status === 'verified').length,
    rejected: mockUsers.filter(u => u.status === 'rejected').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">신청자 관리</h1>
          <p className="text-gray-500 text-sm mt-1">가입자 현황 및 신원인증 요청을 관리합니다.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors self-start sm:self-auto">
          <Download size={15} /> CSV 다운로드
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filterTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`p-4 rounded-2xl border text-left transition-all duration-150 ${
              filterStatus === key
                ? 'bg-[#FF6F61]/10 border-[#FF6F61]/30'
                : 'bg-[#1A1D23] border-gray-800 hover:border-gray-700'
            }`}
          >
            <p className="text-2xl font-extrabold text-white">{counts[key]}</p>
            <p className={`text-xs font-medium mt-0.5 ${filterStatus === key ? 'text-[#FF6F61]' : 'text-gray-500'}`}>{label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input
          type="text"
          placeholder="이름, 직업, 이메일 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#1A1D23] border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
              <Users size={24} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-semibold">검색 결과가 없습니다</p>
            <p className="text-gray-600 text-sm mt-1">다른 검색어나 필터를 사용해보세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider">회원정보</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell">직업 / 나이</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider">상태</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider hidden sm:table-cell">가입일</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredUsers.map((user) => {
                  const sc = statusConfig[user.status as keyof typeof statusConfig];
                  return (
                    <tr key={user.id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm relative ${
                            user.gender === 'male' ? 'bg-blue-500/10 text-blue-400' : 'bg-pink-500/10 text-pink-400'
                          }`}>
                            {user.name[0]}
                            {user.status === 'verified' && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#1A1D23] rounded-full flex items-center justify-center">
                                <ShieldCheck size={11} className="text-green-400" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-white">{user.name}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                user.gender === 'male' ? 'bg-blue-500/10 text-blue-400' : 'bg-pink-500/10 text-pink-400'
                              }`}>
                                {user.gender === 'male' ? 'M' : 'F'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <p className="text-sm text-gray-300">{user.job}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{user.age}세</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${sc.bg} ${sc.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <p className="text-xs text-gray-500">{user.joined}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => toast.success(`${user.name} 승인 완료`)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-xs font-bold transition-colors"
                              >
                                <CheckCircle size={13} /> 승인
                              </button>
                              <button
                                onClick={() => toast.error(`${user.name} 반려 처리`)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors"
                              >
                                <XCircle size={13} /> 반려
                              </button>
                            </>
                          )}
                          <button className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-gray-800/60 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            총 <span className="text-white font-semibold">{filteredUsers.length}</span>명
          </p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center bg-[#FF6F61] text-white rounded-lg text-xs font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
