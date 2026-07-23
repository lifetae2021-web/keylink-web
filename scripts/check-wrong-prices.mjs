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

async function checkWrongPrices() {
  const sessionIds = ['wKJQKuEoPY7JfEOYuJG8', 'c8LJzUKSqS98mx7v3gHY', '1BvpZ0nlKWgcSlw3efVa']; // 136, 135, 134
  
  let wrongCount = 0;
  
  for (const sessionId of sessionIds) {
    const sDoc = await db.collection('sessions').doc(sessionId).get();
    const title = sDoc.exists ? sDoc.data().title : sessionId;
    
    const appsSnap = await db.collection('applications')
      .where('sessionId', '==', sessionId)
      .where('gender', '==', 'male')
      .get();
      
    appsSnap.docs.forEach(d => {
      const data = d.data();
      const basePrice = (data.price || 0) + (data.couponDiscount || 0);
      if (basePrice < 49000) {
        console.log(`[WRONG] ${data.name} (${title}) - Final Paid: ${data.price}, Coupon: ${data.couponDiscount} => Base was ${basePrice}`);
        wrongCount++;
      }
    });
  }
  
  console.log(`Found ${wrongCount} male applicants with base price < 49000.`);
  process.exit(0);
}
checkWrongPrices();
