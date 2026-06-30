const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let serviceAccountKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
    const match = line.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.*)'/);
    if (match) {
      serviceAccountKey = match[1];
    }
  }
});

if (!serviceAccountKey) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('smsTemplates').get();
  snapshot.forEach(doc => {
    console.log('ID:', doc.id);
    console.log('Name:', doc.data().name);
    console.log('Category:', doc.data().category);
    console.log('Content:', doc.data().content);
    console.log('====================');
  });
}

run().catch(console.error);
