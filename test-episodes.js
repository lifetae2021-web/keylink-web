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

async function check() {
  const sessionSnap = await db.collection('sessions').orderBy('episodeNumber', 'desc').limit(10).get();
  for (const doc of sessionSnap.docs) {
    const d = doc.data();
    let cAt = d.createdAt;
    if (cAt && cAt.toDate) cAt = cAt.toDate();
    console.log('Episode:', d.episodeNumber, 'CreatedAt:', cAt);
    
    // Also get matchedCount from matchingSummaries
    const summary = await db.collection('matchingSummaries').doc(doc.id).get();
    let mCount = 0;
    if (summary.exists) {
      mCount = (summary.data().matchedPairs || []).length;
    }
    console.log('  matchedPairs:', mCount);
  }
}
check().catch(console.error);
