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

async function check133() {
  const sessionId = '6COS9J7XNcARDn2Z0TJq'; // 133기
  
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('gender', '==', 'male')
    .get();
    
  let wrongCount = 0;
  
  for (const d of appsSnap.docs) {
    const data = d.data();
    const basePrice = (data.price || 0) + (data.couponDiscount || 0);
    
    if (basePrice < 49000) {
      console.log(`[WRONG] ${data.name} - Final Paid: ${data.price}, Coupon: ${data.couponDiscount} => Base was ${basePrice}`);
      
      // Fix it automatically
      await d.ref.update({
        price: 49000 - (data.couponDiscount || 0)
      });
      console.log(`✅ ${data.name} price fixed to ${49000 - (data.couponDiscount || 0)}`);
      wrongCount++;
    } else {
      console.log(`[OK] ${data.name} - Base was ${basePrice}`);
    }
  }
  
  console.log(`Fixed ${wrongCount} male applicants in 133기.`);
  process.exit(0);
}
check133();
