import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK Initialization (Singleton Pattern)
 * v6.5.1 - Reverted legacy exports to use direct getters for full type safety.
 *          Fixed null-caching: getAdminAuth() / getAdminDb() are called at runtime.
 */

function initializeAdminApp() {
  if (admin.apps.length > 0) return;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('⚠️ [Firebase Admin] Missing environment variables. Admin SDK will not be initialized.');
    if (!projectId) console.warn('  - FIREBASE_ADMIN_PROJECT_ID is missing');
    if (!clientEmail) console.warn('  - FIREBASE_ADMIN_CLIENT_EMAIL is missing');
    if (!privateKey) console.warn('  - FIREBASE_ADMIN_PRIVATE_KEY is missing');
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // CRITICAL: Vercel stores env vars with literal \n — must convert to real newlines
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[Firebase Admin] ✅ SDK initialized. Project:', projectId);
  } catch (error: any) {
    console.error('[Firebase Admin] ❌ Initialization failed:', error.message);
  }
}

initializeAdminApp();

// ── Safe lazy getters (type-safe, call-time evaluated) ──
export function getAdminAuth() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized. Check FIREBASE_ADMIN_* env vars in Vercel.');
  }
  return admin.auth();
}

export function getAdminDb() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized. Check FIREBASE_ADMIN_* env vars in Vercel.');
  }
  return admin.firestore();
}

export function getAdminStorage() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized. Check FIREBASE_ADMIN_* env vars in Vercel.');
  }
  return admin.storage();
}

// ── Legacy named exports ──
// These are getter functions — evaluated at call-time, NOT at module-load time.
// This prevents the null-caching bug where `admin.apps.length === 0` at import time.
export const adminAuth = {
  get instance() { return getAdminAuth(); },
  createCustomToken: (uid: string, claims?: object) => getAdminAuth().createCustomToken(uid, claims),
  verifyIdToken: (token: string) => getAdminAuth().verifyIdToken(token),
  getUser: (uid: string) => getAdminAuth().getUser(uid),
  createUser: (props: admin.auth.CreateRequest) => getAdminAuth().createUser(props),
  updateUser: (uid: string, props: admin.auth.UpdateRequest) => getAdminAuth().updateUser(uid, props),
  deleteUser: (uid: string) => getAdminAuth().deleteUser(uid),
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
