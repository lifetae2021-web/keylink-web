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

// Simulation of userMatching.ts functions using admin sdk
async function testMatchingResult() {
  const sessionId = 'fwoehJ0r8wFHPiMb8GOb';
  const userId = '0z8udcHn91gNnQBY7detUGg0J6q2'; // 박수연
  
  const summaryDoc = await db.collection('matchingSummaries').doc(sessionId).get();
  const summary = summaryDoc.data();
  
  const matchedPairs = summary.matchedPairs || [];
  const partnerIds = matchedPairs
    .filter(p => p.userAId === userId || p.userBId === userId)
    .map(p => p.userAId === userId ? p.userBId : p.userAId);
    
  const isMatched = partnerIds.length > 0;
  console.log(`Is matched: ${isMatched}`);
  console.log('Partner IDs:', partnerIds);
  
  if (isMatched && partnerIds[0]) {
    const partnerId = partnerIds[0];
    const appSnap = await db.collection('applications')
      .where('sessionId', '==', sessionId)
      .where('userId', '==', partnerId)
      .get();
      
    if (!appSnap.empty) {
      const appData = appSnap.docs[0].data();
      console.log('Partner App Data:', {
        name: appData.name,
        slotNumber: appData.slotNumber,
        gender: appData.gender,
        age: appData.age,
        job: appData.job,
        residence: appData.residence
      });
    }
  }
  
  const receivedVotes = summary.voteCountMap[userId] ?? 0;
  console.log(`Received votes from summary: ${receivedVotes}`);
}

testMatchingResult().catch(err => {
  console.error(err);
  process.exit(1);
});
