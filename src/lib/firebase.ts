import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'keylink-demo.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'keylink-demo',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'keylink-web-2caf2.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:000000000000',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let dbInstance: ReturnType<typeof getFirestore>;
try {
  if (typeof window !== 'undefined') {
    // 메모리 캐시 사용: IndexedDB 영구 캐시(persistentMultipleTabManager)는 휴대폰 크롬에서 백그라운드 복귀 후
    // 저장소 잠금이 풀리지 않아 새로고침해도 데이터가 안 뜨고 브라우저를 껐다 켜야 풀리는 문제가 있었다
    dbInstance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  } else {
    dbInstance = getFirestore(app);
  }
} catch {
  // 이미 초기화된 경우(HMR/Fast Refresh) fallback
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

export const storage = getStorage(app);
// SDK 기본 10분 재시도를 10초로 제한하여 멈춤 현상(무한 로딩) 방지 (v3.5.3 Hotfix)
storage.maxUploadRetryTime = 10000;
export default app;
