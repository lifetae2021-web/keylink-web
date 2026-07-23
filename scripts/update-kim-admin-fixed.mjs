import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    let val = value.join('=').trim();
    // Only strip quotes if it's NOT the service account JSON
    if (key.trim() !== 'FIREBASE_SERVICE_ACCOUNT_KEY') {
       val = val.replace(/['"]/g, '');
    } else {
       // If it starts and ends with single quote, strip outer only
       if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
       else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    }
    acc[key.trim()] = val;
  }
  return acc;
}, {});

const serviceAccountJson = envVars.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  console.error('No FIREBASE_SERVICE_ACCOUNT_KEY found in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
});

const db = admin.firestore();

async function fixPrices() {
  try {
    const sessionRef = db.collection('sessions').doc('6COS9J7XNcARDn2Z0TJq');
    await sessionRef.update({ malePrice: 49000 });
    console.log('✅ Session 133 malePrice updated to 49000');

    const appsSnap = await db.collection('applications')
      .where('name', '==', '김태욱')
      .where('sessionId', '==', '6COS9J7XNcARDn2Z0TJq')
      .get();
      
    if (appsSnap.empty) {
      console.log('❌ No applications found for 김태욱 in Session 133');
    } else {
      for (const d of appsSnap.docs) {
        await d.ref.update({ price: 49000 });
        console.log(`✅ Application ${d.id} (김태욱) price updated to 49000`);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPrices();
