'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Search, Image as ImageIcon, FileText, ChevronDown, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, { label: string, color: string, bg: string }> = {
  pending_consult: { label: '상담대기', color: '#64748B', bg: '#F1F5F9' },
  profile_sent: { label: '프로필전달', color: '#3B82F6', bg: '#EFF6FF' },
  negotiating: { label: '조율중', color: '#F59E0B', bg: '#FEF3C7' },
  pending_payment: { label: '결제대기', color: '#8B5CF6', bg: '#F5F3FF' },
  success: { label: '매칭성공', color: '#10B981', bg: '#ECFDF5' },
};

export default function AdminApplicationList() {
// ... (rest of the state and handlers remain the same)
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
  
  // Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerData, setViewerData] = useState<any>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  // Lightbox Gallery State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);

  // Helper to open lightbox with gallery
  const openGallery = (url: string, allPhotos: string[] = [], idProof: string = '', jobProof: string = '') => {
    const combined = [...allPhotos, idProof, jobProof].filter(Boolean);
    setGalleryImages(combined);
    const idx = combined.indexOf(url);
    setCurrentGalleryIndex(idx >= 0 ? idx : 0);
    setPreviewUrl(url);
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextIdx = (currentGalleryIndex + 1) % galleryImages.length;
    setCurrentGalleryIndex(nextIdx);
    setPreviewUrl(galleryImages[nextIdx]);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const prevIdx = (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length;
    setCurrentGalleryIndex(prevIdx);
    setPreviewUrl(galleryImages[prevIdx]);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'private_applications'), orderBy('appliedAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => {
        console.error("[AdminApplicationList] Firebase Error:", err.code, err.message);
        if (err.code === 'permission-denied') {
          toast.error('접근 권한이 없습니다. 관리자 계정인지 확인해주세요.');
        } else {
          toast.error('데이터를 불러오는데 실패했습니다.');
        }
        setLoading(false);
      });

      return () => unsub();
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'private_applications', appId), { status: newStatus });
      toast.success('상태가 변경되었습니다.');
      setOpenDropdownId(null);
    } catch (e) {
      console.error(e);
      toast.error('상태 변경 실패');
    }
  };

  const handleDelete = async (appId: string, name: string) => {
    if (!confirm(`${name} 님의 신청 내역을 완전히 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'private_applications', appId));
      toast.success('신청 내역이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('삭제 실패');
    }
  };

  const filtered = applications.filter(app => {
    const matchesSearch = 
      (app.name || '').includes(searchQuery) ||
      (app.phone || '').includes(searchQuery) ||
      (app.job || '').includes(searchQuery);
    const matchesGender = filterGender === 'all' || app.gender === filterGender;
    return matchesSearch && matchesGender;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[{ id: 'all', label: '전체' }, { id: 'male', label: '남성' }, { id: 'female', label: '여성' }].map(t => (
              <button
                key={t.id}
                onClick={() => setFilterGender(t.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterGender === t.id ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex-1 max-w-md group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <Search size={16} className="text-slate-400 group-focus-within:text-purple-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="이름, 연락처, 직업 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-2xl pr-4 text-sm font-bold text-slate-800 outline-none focus:border-purple-500/30 focus:bg-slate-50/30 transition-all shadow-sm"
            style={{ height: '40px', paddingLeft: '44px' }}
          />
        </div>
      </div>

      {/* Table & Card Container */}
      <div className="mx-auto w-full" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
        <div className="overflow-auto max-h-[75vh]">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead className="hidden md:table-header-group sticky top-0 z-20" style={{ background: '#F8FAFC' }}>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>신청자 정보</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>직업/거주지</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>연락처</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>진행 상태</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-20 text-center"><div className="animate-pulse text-slate-400 font-bold">데이터를 불러오는 중...</div></td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={40} className="text-slate-200" />
                      <p className="text-sm font-bold text-slate-400">신청 내역이 없습니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(app => {
                  const statusInfo = STATUS_MAP[app.status] || STATUS_MAP['pending_consult'];
                  const appliedDate = app.appliedAt?.toDate ? format(app.appliedAt.toDate(), 'MM.dd HH:mm') : '-';
                  
                  return (
                    <React.Fragment key={app.id}>
                      {/* Desktop View Row */}
                      <tr className="hidden md:table-row border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div 
                              onClick={() => { setViewerData(app); setViewerOpen(true); }}
                              className="w-12 h-12 rounded-full border-2 border-slate-100 overflow-hidden bg-slate-50 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform shadow-sm"
                            >
                              {app.photos?.[0] ? (
                                <img src={app.photos[0]} className="w-full h-full object-cover" alt="avatar" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs">{(app.name || 'U')[0]}</div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 text-[0.95rem]">{app.name}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[0.65rem] font-black uppercase ${
                                  app.gender === 'male' ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'
                                }`}>
                                  {app.gender === 'male' ? '남성' : '여성'}
                                </span>
                              </div>
                              <span className="text-[0.75rem] font-bold text-slate-400 mt-0.5">
                                {app.birthDate ? (app.birthDate.includes('-') ? app.birthDate.slice(2, 4) : app.birthDate.slice(0, 2)) : '--'}년생
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-700 text-[0.85rem]">{app.job || '-'}</div>
                          <div className="text-[0.75rem] text-slate-400 mt-0.5">{app.residence || '-'}</div>
                        </td>
                        <td className="p-4 font-bold text-slate-600 text-[0.85rem]">{app.phone}</td>
                        <td className="p-4 text-center">
                          <div className="relative inline-block text-left">
                            <button 
                              onClick={() => setOpenDropdownId(openDropdownId === app.id ? null : app.id)}
                              className="px-3 py-1.5 rounded-xl text-[0.75rem] font-black flex items-center gap-1.5 border transition-all hover:brightness-95 active:scale-95"
                              style={{ color: statusInfo.color, background: statusInfo.bg, borderColor: `${statusInfo.color}30` }}
                            >
                              {statusInfo.label} <ChevronDown size={12} />
                            </button>
                            
                            {openDropdownId === app.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)}></div>
                                <div className="absolute right-0 mt-2 w-36 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden p-1 animate-in slide-in-from-top-2">
                                  {Object.entries(STATUS_MAP).map(([k, v]) => (
                                    <button
                                      key={k}
                                      onClick={() => handleStatusChange(app.id, k)}
                                      className="w-full text-left px-3 py-2 text-[0.75rem] font-bold rounded-xl transition-colors hover:bg-slate-50"
                                      style={{ color: k === app.status ? v.color : '#64748B' }}
                                    >
                                      {v.label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleDelete(app.id, app.name)}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>

                      {/* Mobile View Card */}
                      <tr className="md:hidden">
                        <td colSpan={6} className="p-0 border-b border-slate-100">
                          <div className="p-4 bg-white hover:bg-slate-50 transition-colors">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-14 h-14 rounded-full border-2 border-slate-100 overflow-hidden bg-slate-100 shrink-0 shadow-sm"
                                  onClick={() => { setViewerData(app); setViewerOpen(true); }}
                                >
                                  {app.photos?.[0] ? (
                                    <img src={app.photos[0]} className="w-full h-full object-cover" alt="avatar" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">{(app.name || 'U')[0]}</div>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-800 text-[1.1rem]">{app.name}</span>
                                    <span className={`text-[0.65rem] font-black px-2 py-0.5 rounded-full ${app.gender === 'male' ? 'text-blue-500 bg-blue-50' : 'text-rose-500 bg-rose-50'}`}>
                                      {app.gender === 'male' ? '남성' : '여성'}
                                    </span>
                                  </div>
                                  <div className="text-[0.75rem] text-slate-500 font-bold mt-0.5">
                                    {app.birthDate ? (app.birthDate.includes('-') ? app.birthDate.slice(2, 4) : app.birthDate.slice(0, 2)) : '--'}년생
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  color: statusInfo.color,
                                  background: statusInfo.bg,
                                  border: `1px solid ${statusInfo.color}20`
                                }}>
                                  {statusInfo.label}
                                </span>
                                <button 
                                  onClick={() => handleDelete(app.id, app.name)}
                                  className="text-slate-300 hover:text-rose-500 p-1"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">직업</p>
                                <p className="text-[0.82rem] font-bold text-slate-700 leading-tight truncate">{app.job || '-'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">거주지</p>
                                <p className="text-[0.82rem] font-bold text-slate-700 leading-tight truncate">{app.residence || '-'}</p>
                              </div>
                              <div className="col-span-2 pt-2 border-t border-slate-100 mt-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">연락처</p>
                                <p className="text-[0.85rem] font-bold text-blue-600">{app.phone}</p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setViewerData(app); setViewerOpen(true); }}
                                className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-[0.75rem] shadow-sm active:scale-95 transition-all"
                              >
                                프로필 상세보기
                              </button>
                              <div className="relative flex-1">
                                <button 
                                  onClick={() => setOpenDropdownId(openDropdownId === app.id ? null : app.id)}
                                  className="w-full h-full py-3 rounded-2xl text-[0.75rem] font-black flex items-center justify-center gap-1.5 border transition-all active:scale-95"
                                  style={{ color: statusInfo.color, background: statusInfo.bg, borderColor: `${statusInfo.color}30` }}
                                >
                                  {statusInfo.label} <ChevronDown size={14} />
                                </button>
                                {openDropdownId === app.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)}></div>
                                    <div className="absolute right-0 bottom-full mb-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden p-1 animate-in slide-in-from-bottom-2">
                                      {Object.entries(STATUS_MAP).map(([k, v]) => (
                                        <button
                                          key={k}
                                          onClick={() => handleStatusChange(app.id, k)}
                                          className="w-full text-left px-4 py-3 text-[0.8rem] font-bold rounded-xl transition-colors hover:bg-slate-50"
                                          style={{ color: k === app.status ? v.color : '#64748B' }}
                                        >
                                          {v.label}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Viewer Modal */}
      {viewerOpen && viewerData && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setViewerOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-slate-100 p-4 flex justify-between items-center z-10">
              <h3 className="font-black text-lg text-slate-800">{viewerData.name} 님의 1:1 매칭 프로필</h3>
              <button onClick={() => setViewerOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={16} /></button>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Ideal Types */}
              <div>
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Search size={16} className="text-purple-500" /> 이상형 조건</h4>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-2">
                  {viewerData.idealTypeConditions?.map((cond: string, i: number) => (
                    <p key={i} className="text-sm font-medium text-slate-800"><span className="text-purple-600 font-bold mr-2">{i+1}순위:</span> {cond}</p>
                  ))}
                </div>
              </div>

              {/* Photos */}
              <div>
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><ImageIcon size={16} className="text-purple-500" /> 등록 사진</h4>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {viewerData.photos?.map((url: string, i: number) => (
                    <div key={i} onClick={() => openGallery(url, viewerData.photos, viewerData.idProofUrl, viewerData.employmentProofUrl)} className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                      <img src={url} className="w-32 h-32 object-cover rounded-xl border border-slate-200 shadow-sm" alt="photo" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Proofs */}
              <div>
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><FileText size={16} className="text-purple-500" /> 인증 서류</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div onClick={() => openGallery(viewerData.idProofUrl, viewerData.photos, viewerData.idProofUrl, viewerData.employmentProofUrl)} className="cursor-pointer border border-slate-200 rounded-xl p-3 hover:border-purple-300 transition-colors bg-slate-50 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 mb-2">신분증 사본</p>
                    <div className="w-full h-32 rounded-lg overflow-hidden flex items-center justify-center bg-white border border-slate-100">
                      {viewerData.idProofUrl ? (
                        <img src={viewerData.idProofUrl} className="w-full h-full object-contain" alt="id proof" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-300">
                          <ImageIcon size={24} className="opacity-20" />
                          <span className="text-[10px] font-bold">미등록</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div onClick={() => openGallery(viewerData.employmentProofUrl, viewerData.photos, viewerData.idProofUrl, viewerData.employmentProofUrl)} className="cursor-pointer border border-slate-200 rounded-xl p-3 hover:border-purple-300 transition-colors bg-slate-50 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 mb-2">재직 증명 서류</p>
                    <div className="w-full h-32 rounded-lg overflow-hidden flex items-center justify-center bg-white border border-slate-100">
                      {viewerData.employmentProofUrl ? (
                        <img src={viewerData.employmentProofUrl} className="w-full h-full object-contain" alt="job proof" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-300">
                          <ImageIcon size={24} className="opacity-20" />
                          <span className="text-[10px] font-bold">미등록</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Pop-up with Gallery Navigation */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewUrl(null)}
        >
          {/* Navigation Buttons */}
          {galleryImages.length > 1 && (
            <>
              <button 
                onClick={prevImage}
                className="absolute left-4 md:left-10 z-[210] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-sm"
              >
                <ChevronLeft size={32} />
              </button>
              <button 
                onClick={nextImage}
                className="absolute right-4 md:right-10 z-[210] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-sm"
              >
                <ChevronRight size={32} />
              </button>
              
              {/* Image Counter */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[210] bg-black/50 text-white px-4 py-2 rounded-full font-bold text-sm backdrop-blur-sm border border-white/20">
                {currentGalleryIndex + 1} / {galleryImages.length}
              </div>
            </>
          )}

          <div className="relative max-w-[95vw] max-h-[85vh] flex items-center justify-center">
            <img 
              src={previewUrl} 
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border-4 border-white/10 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()} 
            />
            <button 
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setPreviewUrl(null)}
            >
              <X size={32} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

