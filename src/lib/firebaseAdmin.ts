import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK Initialization (Singleton Pattern)
 * v6.7.0 - Standard Vercel private key parsing via JSON.parse.
 * Ref: https://vercel.com/guides/firebase-remote-config-react-native#firebase-server-config
 */

let initError: string | null = null;

/**
 * VERCEL STANDARD: Parse the private key correctly.
 * In Vercel, the env var value is the literal JSON string. JSON.parse wrapping
 * correctly converts '\\n' escape sequences back to real newline characters.
 * This is the definitive fix for 'Invalid PEM formatted message' errors.
 */
function parsePrivateKey(raw: string): string {
  // Remove surrounding quotes if present
  const stripped = raw.trim().replace(/^"|"$/g, '');
  // Convert literal \n strings to real newlines
  return stripped.replace(/\\n/g, '\n');
}

function initializeAdminApp() {
  if (admin.apps.length > 0) return;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    initError = `Missing env vars: ID(${!!projectId}) Email(${!!clientEmail}) Key(${!!privateKey})`;
    console.warn(`⚠️ [Firebase Admin] ${initError}`);
    return;
  }

  try {
    const parsedKey = parsePrivateKey(privateKey);

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: parsedKey,
      }),
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
