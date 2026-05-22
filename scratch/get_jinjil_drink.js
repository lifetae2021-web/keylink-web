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

async function checkJinjil() {
  const sessionId = 'fwoehJ0r8wFHPiMb8GOb';
  const name = '장진실';

  console.log(`Searching for applications where sessionId = ${sessionId} and name = ${name}...`);
  
  const snap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('name', '==', name)
    .get();

  if (snap.empty) {
    console.log('No application found for 장진실 in this session.');
  } else {
    snap.docs.forEach(doc => {
      console.log(`Found application Doc ID: ${doc.id}`);
      console.log('Document Data:');
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
}

checkJinjil().catch(err => {
  console.error(err);
  process.exit(1);
});
