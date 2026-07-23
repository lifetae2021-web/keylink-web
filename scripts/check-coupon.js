const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    let val = value.join('=').trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    acc[key.trim()] = val;
  }
  return acc;
}, {});

try {
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error(e);
  process.exit(1);
}

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('users')
    .doc('K9hfg0V6fYbGKxkGf4fyXzDkTko2')
    .collection('coupons')
    .doc('AYs0RNXasNDNVTweflaY')
    .get();

  if (!snapshot.exists) {
    console.log('No coupon found');
    return;
  }

  console.log(JSON.stringify(snapshot.data(), null, 2));
}

run().catch(console.error);
