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
  console.log("Could not parse service account json", e);
  process.exit(1);
}

const db = admin.firestore();

async function run() {
  const q1 = await db.collection('applications')
    .where('name', '==', '전정민')
    .get();

  q1.docs.forEach(d => {
    const data = d.data();
    console.log(`Doc ID: ${d.id}`);
    console.log(`- sessionId: ${data.sessionId}`);
    console.log(`- status: ${data.status}`);
    console.log(`- price: ${data.price}`);
    console.log(`- finalPrice: ${data.finalPrice}`);
    console.log(`- couponId: ${data.couponId}`);
    console.log(`- couponTitle: ${data.couponTitle}`);
    console.log(`- couponDiscount: ${data.couponDiscount}`);
    console.log(`- femaleOption: ${data.femaleOption}`);
    console.log(`- groupPartnerName: ${data.groupPartnerName}`);
    console.log('---');
  });
}

run().catch(console.error);
