import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    let val = value.join('=').trim();
    if (key.trim() !== 'FIREBASE_SERVICE_ACCOUNT_KEY') {
       val = val.replace(/['"]/g, '');
    } else {
       if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
       else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    }
    acc[key.trim()] = val;
  }
  return acc;
}, {});

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY)),
});
const db = admin.firestore();

async function initSettings() {
  const settingsRef = db.collection('settings').doc('general');
  const doc = await settingsRef.get();
  
  if (!doc.exists) {
    await settingsRef.set({
      serviceName: '키링크 (KEYLINK)',
      email: 'keylink2025@gmail.com',
      region: '부산, 창원',
      website: 'https://www.keylink.kr',
      
      malePrice: 49000,
      maleSafePrice: 60000,
      femalePrice: 29000,
      femaleGroupPrice: 24000,
      
      capacity: 8,
      matchResultTime: 21,
      reservationDeadline: 2,
      
      notifyNewApp: true,
      notifyVerification: true,
      notifyPayment: true,
      notifyMatch: false,
      notifyD1: true,
      
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ settings/general initialized with default prices!');
  } else {
    // If it exists, ensure the new price fields exist
    await settingsRef.update({
      malePrice: doc.data().malePrice || 49000,
      maleSafePrice: doc.data().maleSafePrice || 60000,
      femalePrice: doc.data().femalePrice || 29000,
      femaleGroupPrice: doc.data().femaleGroupPrice || 24000,
    });
    console.log('✅ settings/general updated with price fields!');
  }
  process.exit(0);
}
initSettings();
