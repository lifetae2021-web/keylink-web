const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkSession() {
  const sessionId = 'fwoehJ0r8wFHPiMb8GOb';
  console.log(`Checking session "${sessionId}"...`);
  const doc = await db.collection('sessions').doc(sessionId).get();
  if (doc.exists) {
    const d = doc.data();
    console.log(JSON.stringify(d, null, 2));
  } else {
    console.log('Session not found!');
  }
}

checkSession();
