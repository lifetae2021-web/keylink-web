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

async function runUpdates() {
  // 1. Update 장진실 (mPExrdSKPHNpGQq0Uki2) -> ["페퍼민트"] (P)
  const jinjilAppId = 'mPExrdSKPHNpGQq0Uki2';
  const jinjilSnap = await db.collection('applications').doc(jinjilAppId).get();
  
  if (jinjilSnap.exists) {
    const jinjilData = jinjilSnap.data();
    const userId = jinjilData.userId;
    
    // Update application
    await db.collection('applications').doc(jinjilAppId).update({
      drink: ['페퍼민트']
    });
    console.log(`Successfully updated application ${jinjilAppId} for 장진실 with ['페퍼민트']`);
    
    // Update user profile
    if (userId) {
      await db.collection('users').doc(userId).update({
        drink: ['페퍼민트']
      });
      console.log(`Successfully updated user profile ${userId} for 장진실 with ['페퍼민트']`);
    }
  } else {
    console.error('Could not find application doc for 장진실.');
  }

  // 2. Update 임지수 (tJlBn4F6Hxxonq69ydU3) -> ["아이스 아메리카노"] (C)
  const jisooAppId = 'tJlBn4F6Hxxonq69ydU3';
  const jisooSnap = await db.collection('applications').doc(jisooAppId).get();
  
  if (jisooSnap.exists) {
    const jisooData = jisooSnap.data();
    const userId = jisooData.userId;
    
    // Update application
    await db.collection('applications').doc(jisooAppId).update({
      drink: ['아이스 아메리카노']
    });
    console.log(`Successfully updated application ${jisooAppId} for 임지수 with ['아이스 아메리카노']`);
    
    // Update user profile
    if (userId) {
      await db.collection('users').doc(userId).update({
        drink: ['아이스 아메리카노']
      });
      console.log(`Successfully updated user profile ${userId} for 임지수 with ['아이스 아메리카노']`);
    }
  } else {
    console.error('Could not find application doc for 임지수.');
  }
}

runUpdates().catch(err => {
  console.error(err);
  process.exit(1);
});
