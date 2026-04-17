'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { User as UserIcon, Mail, Phone, Calendar, UserCircle, LogOut, ArrowLeft, Heart, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      
      setUser(currentUser);
      
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 50%, #FFF5F4 0%, #FFFFFF 100%)'
      }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%',
          border: '3px solid #FFDBE9', borderTop: '3px solid #FF6F61',
          animation: 'spin 1s linear infinite', marginBottom: '20px'
        }} />
        <p style={{ color: '#FF6F61', fontWeight: '700', fontSize: '1.1rem' }}>정보를 불러오는 중...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', paddingTop: '100px', paddingBottom: '80px',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.1) 0%, #FFFFFF 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 20px 80px'
    }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        
        {/* Back Button */}
        <Link href="/" style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', color: '#888', 
          textDecoration: 'none', marginBottom: '24px', fontSize: '0.9rem', fontWeight: '600'
        }}>
          <ArrowLeft size={18} /> 홈으로 돌아가기
        </Link>

        {/* Profile Card */}
        <div style={{
          background: '#FFFFFF', borderRadius: '32px', padding: '48px 32px',
          boxShadow: '0 20px 60px rgba(255, 111, 97, 0.08)', border: '1px solid rgba(255, 219, 233, 0.5)',
          position: 'relative'
        }}>
          
          {/* Heart Badge */}
          <div style={{
            position: 'absolute', top: '24px', right: '24px',
            width: '40px', height: '40px', borderRadius: '12px',
            background: '#FFF5F4', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Heart size={20} color="#FF6F61" fill="#FF6F61" />
          </div>

          {/* Profile Image Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{
              width: '120px', height: '120px', borderRadius: '32px',
              background: 'linear-gradient(135deg, #FFDBE9 0%, #E6E6FA 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(255, 111, 97, 0.15)',
              marginBottom: '20px', overflow: 'hidden', border: '4px solid #FFF'
            }}>
              <UserCircle size={80} color="#FF6F61" strokeWidth={1} />
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '8px' }}>
              {userData?.name || '사용자'} 님
            </h1>
            <div style={{ 
              padding: '6px 16px', background: '#FFF5F4', color: '#FF6F61', 
              borderRadius: '100px', fontSize: '0.85rem', fontWeight: '800'
            }}>
              {userData?.gender === 'male' ? 'PREMIUM GENTLEMAN' : 'PREMIUM LADY'}
            </div>
          </div>

          {/* Info Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '20px', background: '#FDFDFD', borderRadius: '20px', border: '1px solid #F5F5F5' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserIcon size={20} color="#FF6F61" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>아이디</p>
                    <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.username || '-'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={20} color="#FF6F61" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>이메일</p>
                    <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.email || user?.email || '-'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={20} color="#FF6F61" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>생년월일</p>
                    <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.birthDate || '-'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={20} color="#FF6F61" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>연락처</p>
                    <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.phone || '-'}</p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={() => toast.success('준비 중인 기능입니다.')}
              className="kl-btn-primary" 
              style={{ width: '100%', padding: '18px', borderRadius: '100px', fontWeight: '800', fontSize: '1rem' }}
            >
              프로필 수정하기
            </button>
            <button 
              onClick={async () => { await auth.signOut(); router.push('/'); }}
              className="kl-btn-outline" 
              style={{ width: '100%', padding: '18px', borderRadius: '100px', fontWeight: '700', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              로그아웃 <LogOut size={18} />
            </button>
          </div>

        </div>

        {/* Footer Info */}
        <p style={{ textAlign: 'center', marginTop: '32px', color: '#BBB', fontSize: '0.8rem', fontWeight: '500' }}>
          매칭을 위한 소중한 개인정보는 최고 수준의 보안으로 보호됩니다.
        </p>

      </div>
    </div>
  );
}
