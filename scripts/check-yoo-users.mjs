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

const serviceAccountJson = envVars.FIREBASE_SERVICE_ACCOUNT_KEY;
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
});
const db = admin.firestore();

async function run() {
  try {
    const snap = await db.collection('users').where('name', '==', '유관우').get();
    console.log(`Found ${snap.docs.length} users named 유관우:`);
    snap.docs.forEach(d => {
      const data = d.data();
      console.log(`\nUID: ${d.id}`);
      console.log(`isRegistered: ${data.isRegistered}`);
      console.log(`loginMethod: ${data.loginMethod}`);
      console.log(`phone: ${data.phone}`);
      console.log(`job: ${data.job || data.workplace || 'None'}`);
      console.log(`photos: ${data.photos ? data.photos.length : 0} photos`);
      console.log(`employmentProof: ${data.employmentProof ? 'Yes' : 'No'}`);
    });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
