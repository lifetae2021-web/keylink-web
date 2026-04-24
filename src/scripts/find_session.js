const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-5e02d11e49.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findSession() {
  const sessions = await db.collection('sessions').get();
  sessions.forEach(doc => {
    const data = doc.data();
    const date = data.eventDate?.toDate?.() || new Date(data.eventDate);
    if (date.toISOString().startsWith('2026-04-24')) {
      console.log(`FOUND: [${doc.id}] ${data.episodeNumber}기 - ${date.toISOString()}`);
    }
  });
}

findSession();
