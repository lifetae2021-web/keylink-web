const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const sessionId = 'h93In0JvH60iNEFIRrU7';
  const docSnap = await db.collection('sessions').doc(sessionId).get();
  console.log(docSnap.data());
}

check().catch(console.error).finally(() => process.exit(0));
