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
  const userId = 'kakao_4968660810';
  const appsSnap = await db.collection('applications').where('userId', '==', userId).get();
  for (const doc of appsSnap.docs) {
    const data = doc.data();
    console.log('App for session:', data.sessionId, 'Status:', data.status);
    
    // Check matching summary for this session
    const summary = await db.collection('matchingSummaries').doc(data.sessionId).get();
    if (summary.exists) {
      const pairs = summary.data().matchedPairs || [];
      const isMatched = pairs.some(p => p.userAId === userId || p.userBId === userId);
      console.log('  Matched in this session?', isMatched);
    }
  }
}
check().catch(console.error);
