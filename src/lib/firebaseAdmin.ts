import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK Initialization (Singleton Pattern)
 * v6.5.0 - Fixed null-caching bug in legacy exports. Now uses safe late-binding getters.
 */

function initializeAdminApp() {
  if (admin.apps.length > 0) return; // Already initialized

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
        // CRITICAL: Vercel stores env vars with literal \n, must convert to actual newlines
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[Firebase Admin] ✅ SDK initialized successfully. Project:', projectId);
  } catch (error: any) {
    console.error('[Firebase Admin] ❌ Initialization failed:', error.message);
    console.error('[Firebase Admin] Error code:', error.code);
    console.error('[Firebase Admin] Full error:', error);
  }
}

// Initialize on module load
initializeAdminApp();

// ── Safe lazy getters (recommended) ──
// Throws a descriptive error at call-time if SDK failed to initialize
export function getAdminAuth() {
  if (!admin.apps.length) throw new Error('Firebase Admin SDK not initialized. Check FIREBASE_ADMIN_* environment variables in Vercel dashboard.');
  return admin.auth();
}

export function getAdminDb() {
  if (!admin.apps.length) throw new Error('Firebase Admin SDK not initialized. Check FIREBASE_ADMIN_* environment variables in Vercel dashboard.');
  return admin.firestore();
}

export function getAdminStorage() {
  if (!admin.apps.length) throw new Error('Firebase Admin SDK not initialized. Check FIREBASE_ADMIN_* environment variables in Vercel dashboard.');
  return admin.storage();
}

// ── Legacy named exports (backward compatibility) ──
// FIXED v6.5.0: Now uses getter pattern to prevent null-caching at module load time.
// Previously: `admin.apps.length ? admin.auth() : null` — always null if evaluated before init.
export const adminAuth = {
  createCustomToken: (...args: any[]) => getAdminAuth().createCustomToken(...args),
  verifyIdToken: (...args: any[]) => getAdminAuth().verifyIdToken(...args),
  getUser: (...args: any[]) => getAdminAuth().getUser(...args),
  createUser: (...args: any[]) => getAdminAuth().createUser(...args),
  updateUser: (...args: any[]) => getAdminAuth().updateUser(...args),
  deleteUser: (...args: any[]) => getAdminAuth().deleteUser(...args),
};

export const adminDb = {
  collection: (...args: any[]) => getAdminDb().collection(...args as [any]),
  doc: (...args: any[]) => getAdminDb().doc(...args as [any]),
  batch: () => getAdminDb().batch(),
  runTransaction: (...args: any[]) => getAdminDb().runTransaction(...args as [any]),
};

export const adminStorage = {
  bucket: (...args: any[]) => getAdminStorage().bucket(...args as [any]),
};

export default admin;
