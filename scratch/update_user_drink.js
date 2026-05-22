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

// Target Drink mapping or value from CLI args
const drinkArg = process.argv[2];

if (!drinkArg) {
  console.error('Please specify a drink as CLI argument! Example: node scratch/update_user_drink.js "아이스 아메리카노"');
  process.exit(1);
}

// Convert shorthand codes or keep plain text array
const drinks = drinkArg.split(',').map(d => d.trim());

async function updateGitak() {
  const sessionId = 'fwoehJ0r8wFHPiMb8GOb';
  const name = '이기탁';
  const userId = 'kakao_4905061872';

  // 1. Update application doc
  const appQuery = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('name', '==', name)
    .limit(1)
    .get();

  if (appQuery.empty) {
    console.error('No application found for 이기탁.');
    process.exit(1);
  }

  const appDocId = appQuery.docs[0].id;
  await db.collection('applications').doc(appDocId).update({
    drink: drinks
  });
  console.log(`Successfully updated application doc [${appDocId}] with drink:`, drinks);

  // 2. Update user profile doc
  await db.collection('users').doc(userId).update({
    drink: drinks
  });
  console.log(`Successfully updated user profile doc [${userId}] with drink:`, drinks);
}

updateGitak().catch(err => {
  console.error(err);
  process.exit(1);
});
