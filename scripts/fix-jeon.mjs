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

async function fixJeon() {
  const appsSnap = await db.collection('applications')
    .where('userId', '==', 'kakao_4998562097')
    .get();
    
  if (appsSnap.empty) {
    console.log('No application found');
    process.exit(1);
  }
  
  // Sort by appliedAt descending
  const apps = appsSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => b.appliedAt.toMillis() - a.appliedAt.toMillis());
  const latestApp = apps[0];
  
  console.log(`Fixing App ID: ${latestApp.id}`);
  
  await db.collection('applications').doc(latestApp.id).update({
    couponDiscount: 5000,
    couponTitle: '가입 환영 5,000원 쿠폰',
    price: 44000 // 49000 - 5000
  });
  console.log('✅ Application updated');
  
  const couponsSnap = await db.collection('users').doc('kakao_4998562097').collection('coupons').get();
  for (const c of couponsSnap.docs) {
    await c.ref.update({ isUsed: true });
    console.log(`✅ Coupon ${c.id} marked as used`);
  }
  
  process.exit(0);
}
fixJeon();
