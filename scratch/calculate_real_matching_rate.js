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

async function calculateRate() {
  const [summariesSnap, sessionsSnap] = await Promise.all([
    db.collection('matchingSummaries').get(),
    db.collection('sessions').get()
  ]);

  const testSessionIds = new Set();
  const sessionTitleMap = {};
  sessionsSnap.docs.forEach(sDoc => {
    const sData = sDoc.data();
    sessionTitleMap[sDoc.id] = sData.title;
    if (sData.isTest) {
      testSessionIds.add(sDoc.id);
    }
  });

  console.log('--- Test Sessions ---');
  testSessionIds.forEach(id => {
    console.log(`ID: ${id}, Title: ${sessionTitleMap[id]}`);
  });
  console.log('---------------------\n');

  let totalRateWithTest = 0;
  let countWithTest = 0;

  let totalRateWithoutTest = 0;
  let countWithoutTest = 0;

  summariesSnap.docs.forEach(d => {
    const data = d.data();
    const sessionId = d.id;
    const title = sessionTitleMap[sessionId] || 'Unknown Session';
    const pairs = data.matchedPairs || [];
    const unmatched = data.unmatchedUserIds || [];
    const total = pairs.length * 2 + unmatched.length;

    if (total > 0) {
      const rate = (pairs.length * 2) / total * 100;
      console.log(`Session: ${title} (${sessionId})`);
      console.log(`  Pairs: ${pairs.length}, Unmatched: ${unmatched.length}, Total: ${total}`);
      console.log(`  Rate: ${rate.toFixed(2)}%`);
      
      // With test
      totalRateWithTest += rate;
      countWithTest++;

      // Without test
      if (!testSessionIds.has(sessionId)) {
        totalRateWithoutTest += rate;
        countWithoutTest++;
        console.log(`  [Included in Real Stats]`);
      } else {
        console.log(`  [EXCLUDED (Test Session)]`);
      }
      console.log('---');
    }
  });

  const avgWithTest = countWithTest > 0 ? Math.round(totalRateWithTest / countWithTest) : 0;
  const avgWithoutTest = countWithoutTest > 0 ? Math.round(totalRateWithoutTest / countWithoutTest) : 0;

  console.log(`\nAverage Matching Rate (With Test): ${avgWithTest}%`);
  console.log(`Average Matching Rate (EXCLUDING Test): ${avgWithoutTest}%`);
}

calculateRate().catch(err => {
  console.error(err);
  process.exit(1);
});
