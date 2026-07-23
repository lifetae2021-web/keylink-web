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

async function checkSessionPrices() {
  const sessionsSnap = await db.collection('sessions').get();
    
  console.log("=== All Sessions ===");
  const sorted = sessionsSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => b.title?.localeCompare(a.title));
  
  sorted.slice(0, 15).forEach(data => {
    console.log(`[${data.id}] ${data.title} - Price: ${data.price} | Male Price: ${data.malePrice || 'N/A'} | Female Price: ${data.femalePrice || 'N/A'}`);
  });
  
  process.exit(0);
}
checkSessionPrices();
