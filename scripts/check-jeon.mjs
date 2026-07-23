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

async function checkJeon() {
  const appsSnap = await db.collection('applications')
    .where('name', '==', '전종엽')
    .orderBy('appliedAt', 'desc')
    .limit(1)
    .get();
    
  if (appsSnap.empty) {
    console.log('No application found for 전종엽');
    process.exit(1);
  }
  
  const appDoc = appsSnap.docs[0];
  const appData = appDoc.data();
  console.log(`App ID: ${appDoc.id}`);
  console.log(`Current Price: ${appData.price}, Discount: ${appData.couponDiscount}, Status: ${appData.status}`);
  console.log(`User ID: ${appData.userId}`);
  
  const couponsSnap = await db.collection('users').doc(appData.userId).collection('coupons').get();
  console.log(`Coupons: ${couponsSnap.docs.length}`);
  couponsSnap.docs.forEach(d => {
    console.log(` - ${d.id}: ${d.data().title} (isUsed: ${d.data().isUsed})`);
  });
  process.exit(0);
}
checkJeon();
