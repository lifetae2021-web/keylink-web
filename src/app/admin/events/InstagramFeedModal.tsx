'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Download, CheckCircle2, Circle } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

export default function InstagramFeedModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  participants
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  participants: any[];
}) {
  const [selectedMen, setSelectedMen] = useState<string[]>([]);
  const [selectedWomen, setSelectedWomen] = useState<string[]>([]);
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  
  // v11.1.2: 로컬스토리지 대신 Firestore에 영구 저장 (기기 간 연동)
  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;
    const loadFromFirestore = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDoc(doc(db, 'sessions', sessionId));
        if (snap.exists()) {
          const data = snap.data().feedConfig || {};
          if (isMounted) {
            if (data.selectedMen) setSelectedMen(data.selectedMen);
            if (data.selectedWomen) setSelectedWomen(data.selectedWomen);
            if (data.customTexts) setCustomTexts(data.customTexts);
            setIsLoaded(true);
          }
        } else {
          if (isMounted) setIsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load feed config', err);
        if (isMounted) setIsLoaded(true);
      }
    };
    loadFromFirestore();
    return () => { isMounted = false; };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !isLoaded) return;
    const saveToFirestore = async () => {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        await updateDoc(doc(db, 'sessions', sessionId), {
          feedConfig: {
            selectedMen,
            selectedWomen,
            customTexts
          }
        });
      } catch (err) {
        console.error('Failed to save feed state', err);
      }
    };
    const t = setTimeout(saveToFirestore, 1000);
    return () => clearTimeout(t);
  }, [selectedMen, selectedWomen, customTexts, sessionId, isLoaded]);
  
  const captureRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const men = participants.filter(p => p.gender === 'male');
  const women = participants.filter(p => p.gender === 'female');

  const toggleSelection = (id: string, gender: 'male' | 'female') => {
    if (gender === 'male') {
      if (selectedMen.includes(id)) {
        setSelectedMen(selectedMen.filter(i => i !== id));
        setCustomTexts(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        setSelectedMen([...selectedMen, id]);
      }
    } else {
      if (selectedWomen.includes(id)) {
        setSelectedWomen(selectedWomen.filter(i => i !== id));
        setCustomTexts(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        setSelectedWomen([...selectedWomen, id]);
      }
    }
  };

  const toggleSelectAll = (gender: 'male' | 'female') => {
    if (gender === 'male') {
      if (selectedMen.length === men.length && men.length > 0) {
        setSelectedMen([]);
        setCustomTexts(prev => {
          const next = { ...prev };
          men.forEach(m => delete next[m.id]);
          return next;
        });
      } else {
        setSelectedMen(men.map(m => m.id));
      }
    } else {
      if (selectedWomen.length === women.length && women.length > 0) {
        setSelectedWomen([]);
        setCustomTexts(prev => {
          const next = { ...prev };
          women.forEach(w => delete next[w.id]);
          return next;
        });
      } else {
        setSelectedWomen(women.map(w => w.id));
      }
    }
  };

  const getSelectedIdealTypes = (gender: 'male' | 'female') => {
    const list = gender === 'male' ? men : women;
    const selectedIds = gender === 'male' ? selectedMen : selectedWomen;
    return selectedIds.map(id => {
      const p = list.find(x => x.id === id);
      const originalText = p?.idealType || '이상형 정보 없음';
      return { id, text: customTexts[id] ?? originalText };
    });
  };

  const handleCopyGender = (gender: 'male' | 'female') => {
    let text = '';
    getSelectedIdealTypes(gender).forEach(({ text: t }) => text += `# ${t}\n`);
    navigator.clipboard.writeText(text);
    const label = gender === 'male' ? '키링남' : '키링녀';
    toast.success(`${label} 텍스트가 복사되었습니다.`);
  };

  const handleDownload = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 2, // for high res
        useCORS: true,
        backgroundColor: '#EAE6E1'
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sessionName}_이상형_인스타피드.png`;
      link.click();
      toast.success('이미지가 다운로드되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('이미지 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex overflow-hidden">
        
        {/* Left Side: Selection Panel */}
        <div className="w-1/2 border-r border-slate-200 flex flex-col h-full bg-white">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">인스타 피드용 이상형 추출</h2>
              <p className="text-xs text-slate-500 mt-1">참가자들의 전체 이상형을 텍스트로 일괄 복사하거나, 선택하여 이미지로 생성할 수 있습니다.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-500" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 gap-4">
            {/* Men */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-blue-600 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  남성 참가자 ({men.length}명)
                </h3>
                <button
                  onClick={() => toggleSelectAll('male')}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-[0.7rem] font-bold hover:bg-blue-100 transition-colors"
                >
                  <CheckCircle2 size={12} />
                  {selectedMen.length === men.length && men.length > 0 ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="space-y-2">
                {men.map(p => {
                  const isSelected = selectedMen.includes(p.id);
                  return (
                    <div 
                      key={p.id}
                      onClick={() => toggleSelection(p.id, 'male')}
                      className={`p-3 rounded-xl border text-sm cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800">{p.name} ({p.age}년생)</span>
                        {isSelected ? <CheckCircle2 size={16} className="text-blue-500" /> : <Circle size={16} className="text-slate-300" />}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{p.idealType || '미작성'}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Women */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-pink-600 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                  여성 참가자 ({women.length}명)
                </h3>
                <button
                  onClick={() => toggleSelectAll('female')}
                  className="flex items-center gap-1 px-2 py-1 bg-pink-50 text-pink-600 rounded text-[0.7rem] font-bold hover:bg-pink-100 transition-colors"
                >
                  <CheckCircle2 size={12} />
                  {selectedWomen.length === women.length && women.length > 0 ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="space-y-2">
                {women.map(p => {
                  const isSelected = selectedWomen.includes(p.id);
                  return (
                    <div 
                      key={p.id}
                      onClick={() => toggleSelection(p.id, 'female')}
                      className={`p-3 rounded-xl border text-sm cursor-pointer transition-all ${isSelected ? 'border-pink-500 bg-pink-50' : 'border-slate-200 hover:border-pink-300'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800">{p.name} ({p.age}년생)</span>
                        {isSelected ? <CheckCircle2 size={16} className="text-pink-500" /> : <Circle size={16} className="text-slate-300" />}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{p.idealType || '미작성'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Preview & Actions */}
        <div className="w-1/2 bg-slate-50 flex flex-col h-full relative">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <span className="text-sm font-bold text-slate-500">미리보기 (1080x1350 세로형)</span>
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#FF6F61] text-white rounded-lg text-sm font-bold hover:bg-[#e85d50] transition-colors"
              >
                <Download size={14} />
                피드 이미지 저장
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto flex items-center justify-center p-8 bg-slate-100">
            {/* Instagram Feed Canvas (1080x1350 Aspect Ratio roughly 4:5) */}
            <div 
              ref={captureRef}
              className="relative shadow-lg flex flex-col items-center shrink-0"
              style={{
                width: '400px',
                minHeight: '500px',
                backgroundColor: '#EAE6E1',
                padding: '24px 20px',
                fontFamily: 'sans-serif',
              }}
            >
              <h1 className="text-center text-[#7a6a5e] text-[1.05rem] font-medium tracking-tight mb-3">
                {sessionName.replace('부산', '')}번째, 이상형이 현실이 되는 순간
              </h1>

              <div className="w-[360px] flex-1 flex flex-col gap-2">
                {/* Men Box */}
                <div className="bg-[#FAF9F7] p-3.5 shadow-sm w-full" style={{ border: '3px solid #E2DED8', minHeight: '100px' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="inline-block border-b-[2.5px] border-[#b59e89] pb-0.5">
                      <h2 className="text-[#5c4a40] text-[1.05rem] font-extrabold tracking-tight">키링남</h2>
                    </div>
                    <button
                      data-html2canvas-ignore="true"
                      onClick={() => handleCopyGender('male')}
                      className="flex items-center gap-1 px-1.5 py-1 bg-slate-200 text-slate-600 rounded text-[0.65rem] font-bold hover:bg-slate-300 transition-colors"
                    >
                      <Copy size={10} />
                      복사
                    </button>
                  </div>
                  <div className="space-y-1 flex flex-col justify-center">
                    {getSelectedIdealTypes('male').map(({ id, text }, idx) => (
                      <div key={idx} className="flex text-[#333] text-[0.75rem] font-medium leading-tight break-keep items-start hover:bg-black/5 rounded transition-colors group relative">
                        <span className="mr-1 mt-0.5">#</span>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => setCustomTexts({ ...customTexts, [id]: e.currentTarget.innerText })}
                          className="outline-none focus:bg-white focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1 w-full whitespace-pre-wrap cursor-text min-h-[1.2rem]"
                        >
                          {text}
                        </div>
                      </div>
                    ))}
                    {selectedMen.length === 0 && <p className="text-slate-400 text-xs italic">선택된 남성 이상형이 없습니다.</p>}
                  </div>
                </div>

                {/* Women Box */}
                <div className="bg-[#FAF9F7] p-3.5 shadow-sm w-full" style={{ border: '3px solid #E2DED8', minHeight: '100px' }}>
                  <div className="flex items-center justify-between mb-2 flex-row-reverse">
                    <div className="inline-block border-b-[2.5px] border-[#b59e89] pb-0.5 text-right">
                      <h2 className="text-[#5c4a40] text-[1.05rem] font-extrabold tracking-tight">키링녀</h2>
                    </div>
                    <button
                      data-html2canvas-ignore="true"
                      onClick={() => handleCopyGender('female')}
                      className="flex items-center gap-1 px-1.5 py-1 bg-slate-200 text-slate-600 rounded text-[0.65rem] font-bold hover:bg-slate-300 transition-colors"
                    >
                      <Copy size={10} />
                      복사
                    </button>
                  </div>
                  <div className="space-y-1 flex flex-col justify-center">
                    {getSelectedIdealTypes('female').map(({ id, text }, idx) => (
                      <div key={idx} className="flex text-[#333] text-[0.75rem] font-medium leading-tight break-keep items-start justify-end hover:bg-black/5 rounded transition-colors group relative">
                        <span className="mr-1 mt-0.5">#</span>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => setCustomTexts({ ...customTexts, [id]: e.currentTarget.innerText })}
                          className="outline-none focus:bg-white focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1 text-left w-full whitespace-pre-wrap cursor-text min-h-[1.2rem]"
                        >
                          {text}
                        </div>
                      </div>
                    ))}
                    {selectedWomen.length === 0 && <p className="text-slate-400 text-xs italic text-right">선택된 여성 이상형이 없습니다.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
