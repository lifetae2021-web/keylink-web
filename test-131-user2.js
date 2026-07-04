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

async function check131() {
  const sessionSnap = await db.collection('sessions').where('episodeNumber', '==', 131).get();
  const sessionId = sessionSnap.docs[0].id;

  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('status', '==', 'confirmed')
    .get();
    
  for (const doc of appsSnap.docs) {
    const data = doc.data();
    if (data.name === '태영훈기본') {
      const u = await db.collection('users').doc(data.userId).get();
      console.log('User data:', u.data());
      console.log('App data:', data);
      console.log('App doc id:', doc.id);
    }
  }
}
check131().catch(console.error);
