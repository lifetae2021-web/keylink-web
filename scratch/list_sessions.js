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
} catch (e) {
  console.error('Failed to parse service account key:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function listSessions() {
  const snap = await db.collection('sessions').get();
  console.log(`Found ${snap.size} sessions.`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Session ID: ${doc.id}`);
    console.log(`  Title: ${data.title}`);
    console.log(`  Region: ${data.region}`);
    console.log(`  Is Test/Dummy: ${data.isTest || data.isDummy || data.title?.includes('테스트') || data.title?.includes('test')}`);
    console.log(`  Keys: ${Object.keys(data).join(', ')}`);
    console.log('---');
  });
}

listSessions().catch(err => {
  console.error(err);
  process.exit(1);
});
