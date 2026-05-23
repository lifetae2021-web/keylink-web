const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let serviceAccountKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
    serviceAccountKey = line.substring('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim();
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
  const serviceAccount = JSON.parse(serviceAccountKey);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error('Failed to parse service account key:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function inspectUser() {
  const userId = 'kakao_4902384060'; // 허세준
  const sessionId = 'fwoehJ0r8wFHPiMb8GOb';
  
  const userDoc = await db.collection('users').doc(userId).get();
  console.log('User Document Data:', userDoc.data());
  
  const appSnap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('userId', '==', userId)
    .get();
    
  if (!appSnap.empty) {
    console.log('Application Document Data:', appSnap.docs[0].data());
  } else {
    console.log('Application Document not found!');
  }
}

inspectUser().catch(err => {
  console.error(err);
  process.exit(1);
});
