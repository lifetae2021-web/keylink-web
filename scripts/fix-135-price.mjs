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

async function fix135Again() {
  const sessionId = 'c8LJzUKSqS98mx7v3gHY';
  const sessionRef = db.collection('sessions').doc(sessionId);
  await sessionRef.update({
    malePrice: 49000
  });
  console.log(`✅ Session ${sessionId} malePrice updated to 49000`);
  
  const appId = 'YvaTNCiXKttDRUx54QEU'; // Kim Dong-hwan's app
  const appRef = db.collection('applications').doc(appId);
  const appDoc = await appRef.get();
  
  if (appDoc.exists && appDoc.data().name === '김동환') {
    await appRef.update({
      price: 44000 // 49000 - 5000
    });
    console.log(`✅ Application ${appId} (김동환) price updated to 44000`);
  }
  
  process.exit(0);
}
fix135Again();
