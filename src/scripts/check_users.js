const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const clean = line.trim();
  if (clean && !clean.startsWith('#')) {
    const idx = clean.indexOf('=');
    if (idx !== -1) {
      let key = clean.substring(0, idx).trim();
      let val = clean.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      env[key] = val;
    }
  }
});

const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function check() {
  const snap = await db.collection('users').get();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.name?.includes('태영훈') || data.username === 'lifetae2021' || data.role === 'super_admin' || data.role === 'admin') {
      console.log(`ID: ${d.id}, Name: ${data.name}, Username: ${data.username}, Role: ${data.role}`);
    }
  });
}
check();
