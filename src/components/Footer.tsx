'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Camera, X } from 'lucide-react';
import { getContent } from '@/lib/firestore/cms';
import { auth, db, storage } from '@/lib/firebase';
import { deleteUser, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';

export default function Footer() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);

  const openModal = async (key: 'terms' | 'privacy') => {
    const title = key === 'terms' ? '이용약관' : '개인정보처리방침';
    const body = await getContent(key);
    setModal({ title, body: body || `${title}이 아직 등록되지 않았습니다.` });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsub();
  }, []);

  if (pathname === '/register') return null;

const handleDeleteAccount = async () => {
    if (!currentUser) return toast.error('로그인 후 이용 가능합니다.');

    const confirmed = window.confirm(
      '정말 탈퇴하시겠습니까?\n저장된 프로필과 신청 내역이 모두 삭제되며 복구할 수 없습니다.'
    );
    if (!confirmed) return;

    const loadingToast = toast.loading('탈퇴 처리 중...');
    try {
      const uid = currentUser.uid;

      // 1. Delete Storage Files (profile_images/uid/*)
      const storageFolderRef = ref(storage, `profile_images/${uid}`);
      try {
        const fileList = await listAll(storageFolderRef);
        await Promise.all(fileList.items.map(fileRef => deleteObject(fileRef)));
      } catch (err) {
        console.error('Storage cleanup skipped or failed:', err);
      }

      // 2. Delete Application History
      const appQuery = query(collection(db, 'applications'), where('userId', '==', uid));
      const appSnap = await getDocs(appQuery);
      await Promise.all(appSnap.docs.map(d => deleteDoc(d.ref)));

      // 3. Delete Profile Doc
      await deleteDoc(doc(db, 'users', uid));

      // 4. Delete Auth User
      await deleteUser(currentUser);

      toast.dismiss(loadingToast);
      toast.success('탈퇴 처리가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
      router.push('/');
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Withdrawal Error:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('보안을 위해 다시 로그인 후 시도해 주세요.');
        auth.signOut();
        router.push('/login');
      } else {
        toast.error('탈퇴 처리 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  return (
    <footer style={{
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      padding: '60px 20px 30px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Bottom */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* Business Info */}
          <div style={{ 
            fontSize: '0.72rem', 
            color: 'var(--color-text-muted)', 
            lineHeight: 1.8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 12px',
            wordBreak: 'keep-all'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>상호명: 키링크(Keylink)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>대표자: 태영훈</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>사업자등록번호: 483-07-03249</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>연락처: 010-4896-2040</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>주소: 부산광역시 부산진구 중앙대로 763-1, 4층(부전동)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>개인정보보호책임자: 태영훈 (keylink2025@gmail.com)</span>
          </div>

          {/* Contact */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <a href="https://open.kakao.com/o/scJkJdmh" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                <MessageCircle size={14} />
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>카카오톡 <strong style={{ color: 'var(--color-text-primary)' }}>@키링크</strong></span>
            </a>
            <a href="https://instagram.com/keylink_official" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                <Camera size={14} />
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>인스타그램 <strong style={{ color: 'var(--color-text-primary)' }}>@keylink_official</strong></span>
            </a>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>운영: 평일 10:00–22:00 / 주말 09:00–22:00</span>
          </div>

          {/* Copyright + Legal */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', userSelect: 'none' }}>
              © 2026 키링크. All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button onClick={() => openModal('terms')} style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', padding: 0 }}>이용약관</button>
              <button onClick={() => openModal('privacy')} style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', padding: 0 }}>개인정보처리방침</button>
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #eee' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#111' }}>{modal.title}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', fontSize: '0.85rem', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {modal.body}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
