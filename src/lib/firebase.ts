import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
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
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } else {
    dbInstance = getFirestore(app);
  }
} catch {
  // 이미 초기화된 경우(HMR/Fast Refresh) 또는 시크릿 모드 등 스토리지 제한 시 fallback
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

export const storage = getStorage(app);
// SDK 기본 10분 재시도를 10초로 제한하여 멈춤 현상(무한 로딩) 방지 (v3.5.3 Hotfix)
storage.maxUploadRetryTime = 10000;
export default app;
