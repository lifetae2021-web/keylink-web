import * as admin from 'firebase-admin';
import dns from 'node:dns';
import axios from 'axios';

// 로컬 환경(macOS 등)의 IPv6 DNS resolving(ENOTFOUND) 버그를 방지하기 위한 강제 IPv4 폴백 설정
dns.setDefaultResultOrder('ipv4first');

// Next.js 14+ 내장 fetch(undici)가 dns 설정을 무시하고 ENOTFOUND를 내는 버그를 우회하기 위한 전역 패치
const originalFetch = global.fetch;
if (typeof originalFetch === 'function') {
  global.fetch = async (url: any, options?: any) => {
    const urlStr = url?.toString() || '';
    if (urlStr.includes('googleapis.com') || urlStr.includes('kauth.kakao.com') || urlStr.includes('kapi.kakao.com')) {
      try {
        const res = await axios({
          url: urlStr,
          method: options?.method || 'GET',
          headers: options?.headers,
          data: options?.body,
          responseType: 'arraybuffer'
        });
        return new Response(res.data, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers as any
        });
      } catch (e: any) {
        if (e.response) {
          return new Response(e.response.data, {
            status: e.response.status,
            statusText: e.response.statusText,
            headers: e.response.headers as any
          });
        }
        throw e;
      }
    }
    return originalFetch(url, options);
  };
}

/**
 * Firebase Admin SDK Initialization (Singleton Pattern)
 * v6.7.2 - Single JSON key approach: FIREBASE_SERVICE_ACCOUNT_KEY
 * Parses the entire service account JSON in one shot, eliminating all PEM issues.
 */

let initError: string | null = null;

function initializeAdminApp() {
  if (admin.apps.length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountJson) {
    initError = 'Missing env var: FIREBASE_SERVICE_ACCOUNT_KEY';
    console.warn(`⚠️ [Firebase Admin] ${initError}`);
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase Admin] ✅ Auth System Initialized Successfully.');
  } catch (error: any) {
    initError = `Init Failed: ${error.message}`;
    console.error('[Firebase Admin] ❌ Initialization failed:', error.message);
  }
}

initializeAdminApp();

// ── Safe lazy getters (type-safe, call-time evaluated) ──
export function getAdminAuth() {
  if (!admin.apps.length) throw new Error(initError || 'Firebase Admin SDK not initialized.');
  return admin.auth();
}

export function getAdminDb() {
  if (!admin.apps.length) throw new Error(initError || 'Firebase Admin SDK not initialized.');
  return admin.firestore();
}

export function getAdminStorage() {
  if (!admin.apps.length) throw new Error(initError || 'Firebase Admin SDK not initialized.');
  return admin.storage();
}

// ── Legacy named exports ──
// These are getter functions — evaluated at call-time, NOT at module-load time.
// This prevents the null-caching bug where `admin.apps.length === 0` at import time.
export const adminAuth = {
  get instance() { return getAdminAuth(); },
  createCustomToken: (uid: string, claims?: object) => getAdminAuth().createCustomToken(uid, claims),
  verifyIdToken: async (token: string) => {
    // 로컬 환경(맥북 IPv6 DNS 버그) 방어를 위해 개발 모드에서는 서명 검증(네트워크 통신)을 건너뛰고 JWT를 로컬에서 직접 디코딩합니다.
    if (process.env.NODE_ENV === 'development') {
      try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        return { ...payload, uid: payload.sub || payload.user_id };
      } catch (e) {
        console.error('Local JWT decode failed, falling back to network verify:', e);
      }
    }
    // 운영(실서버) 환경에서는 정상적으로 구글 API 통신을 통해 서명까지 완벽하게 검증합니다.
    return getAdminAuth().verifyIdToken(token);
  },
  getUser: (uid: string) => getAdminAuth().getUser(uid),
  createUser: (props: admin.auth.CreateRequest) => getAdminAuth().createUser(props),
  updateUser: (uid: string, props: admin.auth.UpdateRequest) => getAdminAuth().updateUser(uid, props),
  deleteUser: (uid: string) => getAdminAuth().deleteUser(uid),
  getUsers: (identifiers: { uid: string }[]) => getAdminAuth().getUsers(identifiers),
};

// adminDb: returns the full Firestore instance so all chaining works correctly with proper types
export const adminDb = {
  get instance() { return getAdminDb(); },
  collection: (path: string) => getAdminDb().collection(path),
  doc: (path: string) => getAdminDb().doc(path),
  batch: () => getAdminDb().batch(),
  runTransaction: <T>(updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>) =>
    getAdminDb().runTransaction(updateFunction),
};

export const adminStorage = {
  bucket: (name?: string) => getAdminStorage().bucket(name),
};

export default admin;
