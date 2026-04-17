'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User as UserIcon, Mail, Phone, Calendar, UserCircle, LogOut, ArrowLeft, Heart, Smartphone, Camera, Check, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    name: '',
    phone: '',
    birthDate: '',
  });
  const [isSaving, setIsSaving] = useState(false);

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
          const data = docSnap.data();
          setUserData(data);
          setEditForm({
            name: data.name || '',
            phone: data.phone || '',
            birthDate: data.birthDate || '',
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const formatBirthDate = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };

  const handleEditChange = (key: string, value: string) => {
    let formattedValue = value;
    if (key === 'phone') formattedValue = formatPhone(value);
    if (key === 'birthDate') formattedValue = formatBirthDate(value);
    setEditForm((prev: any) => ({ ...prev, [key]: formattedValue }));
  };

  const handleSave = async () => {
    if (!editForm.name) return toast.error('이름을 입력해주세요.');
    if (!editForm.phone) return toast.error('연락처를 입력해주세요.');
    if (!editForm.birthDate) return toast.error('생년월일을 입력해주세요.');

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user!.uid);
      await updateDoc(userRef, {
        name: editForm.name,
        phone: editForm.phone,
        birthDate: editForm.birthDate,
        updatedAt: new Date(),
      });
      
      setUserData((prev: any) => ({
        ...prev,
        ...editForm
      }));
      setIsEditing(false);
      toast.success('프로필 정보가 수정되었습니다.');
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error('정보 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

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
              width: '140px', height: '140px', borderRadius: '24px',
              background: '#FDFDFD',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)',
              marginBottom: '20px', overflow: 'hidden', border: '1px dashed #FFDBE9',
              flexDirection: 'column', gap: '8px', textAlign: 'center', padding: '10px'
            }}>
              <Camera size={28} color="#FFDBE9" />
              <span style={{ fontSize: '0.75rem', color: '#FFDBE9', fontWeight: '700', lineHeight: 1.4 }}>
                이미지를<br/>첨부해주세요
              </span>
            </div>
            
            {isEditing ? (
              <div style={{ width: '100%', maxWidth: '200px' }}>
                <input
                  type="text"
                  className="kl-input"
                  style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: '900', background: '#FFFDFD', borderBottom: '2px solid #FF6F61' }}
                  value={editForm.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  placeholder="이름 입력"
                />
              </div>
            ) : (
              <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '8px' }}>
                {userData?.name || '사용자'} 님
              </h1>
            )}
            
            <div style={{ 
              padding: '6px 16px', background: '#FFF5F4', color: '#FF6F61', 
              borderRadius: '100px', fontSize: '0.85rem', fontWeight: '800', marginTop: isEditing ? '12px' : '0'
            }}>
              {userData?.gender === 'male' ? 'PREMIUM GENTLEMAN' : 'PREMIUM LADY'}
            </div>
          </div>

          {/* Info Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '24px', background: '#FDFDFD', borderRadius: '24px', border: '1px solid #F5F5F5' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* ID (Readonly) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserIcon size={20} color="#FF6F61" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>아이디</p>
                    <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.username || '-'}</p>
                  </div>
                </div>

                {/* Email (Readonly in this view) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={20} color="#FF6F61" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>이메일</p>
                    <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.email || user?.email || '-'}</p>
                  </div>
                </div>

                {/* Birthdate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={20} color="#FF6F61" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>생년월일</p>
                    {isEditing ? (
                      <input
                        type="text"
                        className="kl-input"
                        style={{ padding: '8px 0', fontSize: '1rem', fontWeight: '700', height: 'auto', border: 'none', borderBottom: '1px solid #eee' }}
                        value={editForm.birthDate}
                        onChange={(e) => handleEditChange('birthDate', e.target.value)}
                        placeholder="YYYY-MM-DD"
                      />
                    ) : (
                      <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.birthDate || '-'}</p>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={20} color="#FF6F61" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '2px' }}>연락처</p>
                    {isEditing ? (
                      <input
                        type="tel"
                        className="kl-input"
                        style={{ padding: '8px 0', fontSize: '1rem', fontWeight: '700', height: 'auto', border: 'none', borderBottom: '1px solid #eee' }}
                        value={editForm.phone}
                        onChange={(e) => handleEditChange('phone', e.target.value)}
                        placeholder="010-0000-0000"
                      />
                    ) : (
                      <p style={{ fontSize: '1rem', color: '#333', fontWeight: '700' }}>{userData?.phone || '-'}</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isEditing ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      name: userData?.name || '',
                      phone: userData?.phone || '',
                      birthDate: userData?.birthDate || '',
                    });
                  }}
                  className="kl-btn-outline" 
                  disabled={isSaving}
                  style={{ flex: 1, padding: '18px', borderRadius: '100px', fontWeight: '700', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <X size={18} /> 취소
                </button>
                <button 
                  onClick={handleSave}
                  className="kl-btn-primary" 
                  disabled={isSaving}
                  style={{ flex: 1.5, padding: '18px', borderRadius: '100px', fontWeight: '800', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  {isSaving ? '저장 중...' : <><Check size={18} /> 저장하기</>}
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
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
              </>
            )}
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
