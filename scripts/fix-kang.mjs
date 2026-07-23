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

async function fixKang() {
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', 'c8LJzUKSqS98mx7v3gHY')
    .where('name', '==', '강경민')
    .get();
    
  if (!appsSnap.empty) {
    const docRef = appsSnap.docs[0].ref;
    await docRef.update({
      price: 49000
    });
    console.log('✅ 강경민 price fixed to 49000');
  } else {
    console.log('Not found');
  }
  
  process.exit(0);
}
fixKang();
