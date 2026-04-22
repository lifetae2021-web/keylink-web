import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK Initialization (Singleton Pattern)
 * v5.5.0 - Refactored to use individual environment variables for better reliability.
 */

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('⚠️ [Firebase Admin] Missing environment variables:');
      if (!projectId) console.warn(' - FIREBASE_ADMIN_PROJECT_ID');
      if (!clientEmail) console.warn(' - FIREBASE_ADMIN_CLIENT_EMAIL');
      if (!privateKey) console.warn(' - FIREBASE_ADMIN_PRIVATE_KEY');
      console.warn('Firebase Admin SDK will NOT be initialized. Some admin features will fail.');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Handle newline characters in private key (standard fix for .env parsing)
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin SDK initialized successfully.');
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();

export default admin;
