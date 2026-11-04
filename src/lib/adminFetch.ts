import { auth } from '@/lib/firebase';

// 관리자 화면에서 관리자 전용 API를 부를 때: 로그인 토큰을 자동으로 붙인다.
export async function adminFetch(input: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(input, { ...init, headers: { ...(init.headers || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
}
