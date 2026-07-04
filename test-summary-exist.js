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
  const sessionSnap = await db.collection('sessions').where('episodeNumber', '==', 130).get();
  const sessionId = sessionSnap.docs[0].id;
  const summarySnap = await db.collection('matchingSummaries').doc(sessionId).get();
  console.log('Session ID:', sessionId);
  console.log('Summary exists?', summarySnap.exists);
}
check().catch(console.error);
