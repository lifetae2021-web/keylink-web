'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Lock, Mail, AlertCircle, Loader2, UnlockKeyhole } from 'lucide-react';
import toast from 'react-hot-toast';
import SocialAuth from '@/components/SocialAuth';

export default function AdminLoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let loginEmail = loginId;
      if (!loginId.includes('@')) {
        // Try searching for the user in multiple fields
        const collectionsRef = collection(db, 'users');
        const searchQueries = [
          query(collectionsRef, where('username', '==', loginId)),
          query(collectionsRef, where('name', '==', loginId)),
          query(collectionsRef, where('uid', '==', loginId)),
          query(collectionsRef, where('naverId', '==', loginId)),
          query(collectionsRef, where('kakaoId', '==', loginId)),
        ];

        const snapshots = await Promise.all(searchQueries.map(q => getDocs(q)));
        const foundDoc = snapshots.find(snap => !snap.empty)?.docs[0];
        
        if (!foundDoc) {
          toast.error('존재하지 않는 아이디입니다.');
          setIsLoading(false);
          return;
        }
        
        loginEmail = foundDoc.data().email;
        if (!loginEmail) {
          toast.error('이메일 정보가 없는 계정입니다. 소셜 로그인을 이용해 주세요.');
          setIsLoading(false);
          return;
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;

      // Check for admin role in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        toast.success('관리자 로그인 성공!');
        router.push('/admin');
      } else {
        await auth.signOut();
        toast.error('관리 권한이 없는 계정입니다.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('로그인 정보가 올바르지 않습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1115] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF6F61] to-[#E6E6FA] mb-4 shadow-lg shadow-primary/20">
            <Lock className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Keylink Admin</h1>
          <p className="text-gray-400 mt-2">관리자 센터 액세스를 위해 로그인하세요</p>
        </div>

        <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">아이디 (또는 이메일)</label>
              <div className="relative">
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-[#0F1115] border border-gray-700 rounded-xl py-3 px-11 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FF6F61]/50 focus:border-[#FF6F61] transition-all"
                  placeholder="아이디 또는 이메일 입력"
                  required
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">비밀번호</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0F1115] border border-gray-700 rounded-xl py-3 px-11 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FF6F61]/50 focus:border-[#FF6F61] transition-all"
                  placeholder="••••••••"
                  required
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#FF6F61] to-[#E6E6FA] text-white font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>로그인 <UnlockKeyhole size={18} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex items-center justify-center mb-6">
              <div className="border-t border-gray-800 w-full"></div>
              <span className="bg-[#1A1D23] px-4 text-xs text-gray-500 absolute">또는</span>
            </div>

            <SocialAuth isAdmin isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800 flex items-start gap-3 bg-gray-900/50 p-4 rounded-xl">
            <AlertCircle className="text-[#FF6F61] shrink-0" size={18} />
            <p className="text-xs text-gray-500 leading-relaxed">
              보안을 위해 승인된 IP 주소와 관리자 권한이 부여된 계정만 접근 가능합니다. 
              비정상적인 접근 시도는 기록되며 제한될 수 있습니다.
            </p>
          </div>
        </div>

        <p className="text-center mt-8 text-gray-600 text-sm">
          © 2026 Keylink Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
