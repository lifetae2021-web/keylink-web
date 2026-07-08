import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envConfig = fs.readFileSync('.env.local', 'utf-8');
envConfig.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    process.env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!global.adminApp) {
  global.adminApp = initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function checkUser() {
  const appsSnapshot = await db.collection('applications').where('name', '==', '최영훈').get();
  
  if (appsSnapshot.empty) {
    console.log("No applications found for 최영훈");
    return;
  }
  
  appsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(data);
  });
}

checkUser();
