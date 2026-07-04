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
  const s1 = await db.collection('sessions').doc('7iZM84Cn9O4mZZofhYRW').get();
  console.log('7iZM84Cn9O4mZZofhYRW:', s1.data() ? s1.data().episodeNumber : 'null');

  const s2 = await db.collection('sessions').doc('DcoKeRX3Anvq7EijvcHh').get();
  console.log('DcoKeRX3Anvq7EijvcHh:', s2.data() ? s2.data().episodeNumber : 'null');
}
check().catch(console.error);
