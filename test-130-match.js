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
  // 1. Get 130 session ID
  const sessionSnap = await db.collection('sessions').where('episodeNumber', '==', 130).get();
  const sessionId = sessionSnap.docs[0].id;
  console.log('Session 130 ID:', sessionId);

  // 2. Find 이지원 in 130 session
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('name', '==', '이지원')
    .get();
    
  if (appsSnap.empty) {
    console.log('이지원 not found in 130 apps');
    // Maybe search users collection globally
    const usersSnap = await db.collection('users').where('name', '==', '이지원').get();
    usersSnap.docs.forEach(d => console.log('User found:', d.id, d.data().name, d.data().matchCount));
  } else {
    for (const doc of appsSnap.docs) {
      const data = doc.data();
      const userId = data.userId;
      console.log('이지원 User ID:', userId);

      // 3. Check matchingSummary for 130
      const summarySnap = await db.collection('matchingSummaries').doc(sessionId).get();
      if (summarySnap.exists) {
        const pairs = summarySnap.data().matchedPairs || [];
        console.log('Matched Pairs for 130:');
        console.log(pairs);
        const isMatched = pairs.some(p => p.userAId === userId || p.userBId === userId);
        console.log('Is 이지원 matched in 130?', isMatched);
      } else {
        console.log('No matching summary for 130');
      }

      // 4. Check user document matchCount
      const userSnap = await db.collection('users').doc(userId).get();
      console.log('User DB matchCount:', userSnap.data().matchCount);
    }
  }
}
check().catch(console.error);
