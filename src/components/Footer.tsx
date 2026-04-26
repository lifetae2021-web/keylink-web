'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Camera, X } from 'lucide-react';
import { useRef } from 'react';
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
  const lastTapTime = useRef<number>(0);
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

  const handleHiddenAdminLink = () => {
    const now = Date.now();
    const gap = now - lastTapTime.current;
    if (gap > 0 && gap < 2000) {
      router.push('/admin');
    }
    lastTapTime.current = now;
  };

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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          marginBottom: '48px',
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', height: '60px', overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: '180px', width: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  src="/logo.png"
                  alt="키링크 로고"
                  width={180}
                  height={180}
                  style={{ height: '180px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.7 }}>
              부산 지역 프리미엄<br />로테이션 소개팅 서비스
            </p>
          </div>

          {pathname === '/' && (
            <>
              {/* Links */}
              <div>
                <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '0.875rem', color: 'var(--color-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>서비스</h4>
                {[
                  { href: '/events', label: '참여 신청' },
                  { href: '/events?region=busan', label: '부산점' },
                  { href: '/matching', label: '매칭 순위 입력' },
                  { href: '/matching/result', label: '매칭 결과 확인' },
                ].map((l) => (
                  <Link key={l.href} href={l.href} style={{
                    display: 'block', marginBottom: '10px',
                    fontSize: '0.875rem', color: 'var(--color-text-muted)',
                    textDecoration: 'none', transition: 'color 0.2s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary-light)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                  >{l.label}</Link>
                ))}
              </div>

              <div>
                <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '0.875rem', color: 'var(--color-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>고객 지원</h4>
                {[
                  { href: '/notices', label: '공지사항' },
                  { href: '/notices#faq', label: 'FAQ' },
                  { href: '/notices#rules', label: '이용 규정' },
                  { href: '/mypage', label: '마이페이지' },
                ].map((l) => (
                  <Link key={l.href} href={l.href} style={{
                    display: 'block', marginBottom: '10px',
                    fontSize: '0.875rem', color: 'var(--color-text-muted)',
                    textDecoration: 'none', transition: 'color 0.2s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary-light)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                  >{l.label}</Link>
                ))}
                <button
                  onClick={handleDeleteAccount}
                  style={{
                    display: 'block', padding: 0, border: 'none', background: 'none',
                    marginTop: '10px', fontSize: '0.75rem', color: '#999',
                    cursor: 'pointer', transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6F61'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#999'; }}
                >
                  회원탈퇴
                </button>
              </div>

              {/* Contact */}
              <div>
                <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '0.875rem', color: 'var(--color-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>문의</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <a href="https://open.kakao.com/keylink" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                      <MessageCircle size={16} />
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>카카오톡 채널</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>@키링크</strong>
                    </div>
                  </a>
                  <a href="https://instagram.com/keylink_official" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                      <Camera size={16} />
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>인스타그램 DM</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>@keylink_official</strong>
                    </div>
                  </a>
                </div>
                <div style={{
                  marginTop: '20px',
                  padding: '14px',
                  background: 'rgba(255,111,97,0.08)',
                  border: '1px solid rgba(255,111,97,0.2)',
                  borderRadius: '12px',
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: '600' }}>운영 시간</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>평일 10:00 – 22:00<br />주말 09:00 – 22:00</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          {/* Business Info */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <p>상호명: 키링크(Keylink)</p>
              <p>대표자: 태영훈</p>
              <p>사업자등록번호: 483-07-03249</p>
              <p>연락처: 010-4896-2040</p>
            </div>
            <div>
              <p>주소: 부산광역시 부산진구 중앙대로 763-1, 4층(부전동)</p>
              <p>개인정보보호책임자: 태영훈 (keylink2025@gmail.com)</p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div 
              style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', cursor: 'default', userSelect: 'none' }}
              onDoubleClick={handleHiddenAdminLink}
              onTouchStart={handleHiddenAdminLink}
            >
              © 2026 키링크. All rights reserved. | <span className="text-black text-sm font-semibold">v2.0.1</span>
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
