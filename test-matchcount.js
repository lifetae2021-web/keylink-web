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
  const usersSnap = await db.collection('users').where('matchCount', '>', 0).get();
  console.log(`Found ${usersSnap.size} users with matchCount > 0`);
  usersSnap.docs.forEach(d => console.log(d.data().name, d.data().matchCount));
}
check().catch(console.error);
