const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const keyLine = env.split('\n').find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
let key = keyLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim();
if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(key)),
});
const db = admin.firestore();

async function fix() {
  const summariesSnap = await db.collection('matchingSummaries').get();
  const matchCounts = {}; // { userId: count }

  for (const doc of summariesSnap.docs) {
    const data = doc.data();
    // Only count if session is completed (optional, or just assume if it has matchedPairs it's valid)
    // Wait, check session status
    const sessionDoc = await db.collection('sessions').doc(doc.id).get();
    if (!sessionDoc.exists || sessionDoc.data().status !== 'completed') continue;

    const pairs = data.matchedPairs || [];
    for (const pair of pairs) {
      matchCounts[pair.userAId] = (matchCounts[pair.userAId] || 0) + 1;
      matchCounts[pair.userBId] = (matchCounts[pair.userBId] || 0) + 1;
    }
  }

  const batch = db.batch();
  let count = 0;
  for (const [userId, mCount] of Object.entries(matchCounts)) {
    // Only update if userId is not system/dummy
    if (userId.startsWith('user_m_') || userId.startsWith('user_f_') || userId.startsWith('system_')) continue;
    const uRef = db.collection('users').doc(userId);
    batch.update(uRef, { matchCount: mCount });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
    }
  }
  if (count % 400 !== 0) {
    await batch.commit();
  }
  console.log(`Updated matchCount for ${count} users.`);
}
fix().catch(console.error);
