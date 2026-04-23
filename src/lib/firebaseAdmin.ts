import * as admin from 'firebase-admin';

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
