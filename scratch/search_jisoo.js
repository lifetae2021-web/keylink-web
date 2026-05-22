const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let serviceAccountKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
    // Extract everything after the '='
    serviceAccountKey = line.substring('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim();
    // Strip wrapping quotes (single or double)
    if ((serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
        (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))) {
      serviceAccountKey = serviceAccountKey.substring(1, serviceAccountKey.length - 1);
    }
  }
});

if (!serviceAccountKey) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
  process.exit(1);
}

try {
  // Parse and initialize firebase-admin
  const serviceAccount = JSON.parse(serviceAccountKey);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully.');
} catch (e) {
  console.error('Failed to parse service account key:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function searchJisoo() {
  const name = '임지수';
  console.log(`Searching all applications by name: ${name}`);
  const snap = await db.collection('applications').where('name', '==', name).get();
  
  if (snap.empty) {
    console.log('No applications found by name 임지수.');
  } else {
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Doc ID: ${doc.id}`);
      console.log(`Session ID: ${data.sessionId}`);
      console.log(`Status: ${data.status}`);
      console.log(`Drink: ${JSON.stringify(data.drink)}`);
      console.log('---');
    });
  }
}

searchJisoo().catch(err => {
  console.error(err);
  process.exit(1);
});
