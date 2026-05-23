const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Load .env.local manually using regex to get the single quoted JSON
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([^']*)'/);
if (!match) {
  console.error("Could not find FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
  process.exit(1);
}

const serviceAccount = JSON.parse(match[1]);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const sessionsSnap = await db.collection('sessions').get();
  const sessions = sessionsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    eventDate: doc.data().eventDate?.toDate() || new Date(0)
  }));

  // Sort sessions chronologically
  sessions.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  const summariesSnap = await db.collection('matchingSummaries').get();
  const summariesMap = {};
  summariesSnap.docs.forEach(doc => {
    summariesMap[doc.id] = doc.data();
  });

  let globalMatchCounter = 0;
  for (const session of sessions) {
    if (session.isTest) continue; // Skip test sessions
    const summary = summariesMap[session.id];
    if (!summary) continue;

    const pairs = summary.matchedPairs || [];
    // Sort pairs deterministically within each session by male slot number
    const appsSnap = await db.collection('applications')
      .where('sessionId', '==', session.id)
      .where('status', '==', 'confirmed')
      .get();
    const appMap = {};
    appsSnap.docs.forEach(doc => {
      appMap[doc.id] = doc.data();
      appMap[doc.data().userId] = doc.data();
    });

    const sortedPairs = [...pairs].sort((pairX, pairY) => {
      const maleAppX = appMap[pairX.userAId]?.gender === 'male' ? appMap[pairX.userAId] : appMap[pairX.userBId];
      const maleAppY = appMap[pairY.userAId]?.gender === 'male' ? appMap[pairY.userAId] : appMap[pairY.userBId];
      return (maleAppX?.slotNumber || 999) - (maleAppY?.slotNumber || 999);
    });

    console.log(`\n=== Session: ${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기 (${session.eventDate.toLocaleDateString()}) ===`);
    for (const pair of sortedPairs) {
      globalMatchCounter++;
      const userA = appMap[pair.userAId];
      const userB = appMap[pair.userBId];
      const male = userA?.gender === 'male' ? userA : userB;
      const female = userA?.gender === 'female' ? userA : userB;
      console.log(`  [Match #${globalMatchCounter}] Male: ${male?.name || '?'}(${male?.slotNumber}호) - Female: ${female?.name || '?'}(${female?.slotNumber}호)`);
    }
  }

  console.log(`\nTotal global matches count: ${globalMatchCounter}`);
  process.exit(0);
}

run();
