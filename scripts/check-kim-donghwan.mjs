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

async function checkKimDongHwan() {
  const appsSnap = await db.collection('applications')
    .where('name', '==', '김동환')
    .get();
    
  if (appsSnap.empty) {
    console.log('No application found for 김동환');
    process.exit(1);
  }
  
  // Sort by appliedAt descending
  const apps = appsSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => b.appliedAt.toMillis() - a.appliedAt.toMillis());
  const latestApp = apps[0];
  
  console.log(`App ID: ${latestApp.id}`);
  console.log(`Session ID: ${latestApp.sessionId}`);
  console.log(`Price: ${latestApp.price}`);
  console.log(`Coupon Discount: ${latestApp.couponDiscount}`);
  console.log(`Coupon Title: ${latestApp.couponTitle}`);
  
  // Get session info
  const sessionDoc = await db.collection('sessions').doc(latestApp.sessionId).get();
  if (sessionDoc.exists) {
    const sData = sessionDoc.data();
    console.log(`Session Title: ${sData.title}`);
    console.log(`Male Price: ${sData.malePrice || sData.price}`);
  }
  
  process.exit(0);
}
checkKimDongHwan();
