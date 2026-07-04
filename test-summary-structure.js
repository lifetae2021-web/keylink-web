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
  const summariesSnap = await db.collection('matchingSummaries').limit(1).get();
  summariesSnap.docs.forEach(d => {
    console.log(d.id);
    const data = d.data();
    console.log('Keys:', Object.keys(data));
    console.log('voteCountMap type:', typeof data.voteCountMap);
    if (data.voteCountMap) {
      console.log('voteCountMap sample:', Object.entries(data.voteCountMap).slice(0, 3));
    }
  });
}
check().catch(console.error);
