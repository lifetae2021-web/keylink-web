import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK Initialization (Singleton Pattern)
 * v5.5.1 - Safe initialization: exports are lazy getters to prevent crash on missing env vars.
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
    console.log('[Firebase Admin] SDK initialized successfully.');
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
  }
}

// Initialize on module load
initializeAdminApp();

// Safe lazy getters — will not crash if admin app failed to init
// Each usage will get a proper error at call-time instead of at build-time
export function getAdminAuth() {
  if (!admin.apps.length) throw new Error('Firebase Admin SDK not initialized. Check environment variables.');
  return admin.auth();
}

export function getAdminDb() {
  if (!admin.apps.length) throw new Error('Firebase Admin SDK not initialized. Check environment variables.');
  return admin.firestore();
}

export function getAdminStorage() {
  if (!admin.apps.length) throw new Error('Firebase Admin SDK not initialized. Check environment variables.');
  return admin.storage();
}

// Legacy named exports for backward compatibility (safe: only called at runtime, not build time)
export const adminAuth = admin.apps.length ? admin.auth() : null as any;
export const adminDb = admin.apps.length ? admin.firestore() : null as any;
export const adminStorage = admin.apps.length ? admin.storage() : null as any;

export default admin;
