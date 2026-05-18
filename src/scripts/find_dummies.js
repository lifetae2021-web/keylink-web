const admin = require('firebase-admin');
const fs = require('fs');

const certPaths = [
  '/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json',
  '/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-5e02d11e49.json'
];

let serviceAccount = null;
for (const p of certPaths) {
  if (fs.existsSync(p)) {
    serviceAccount = require(p);
    break;
  }
}

if (!serviceAccount) {
  console.error('Service account JSON not found!');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function inspectSession() {
  const sessionId = 'hjkQQNZNQ7DUdVmqoBQh';
  const doc = await db.collection('sessions').doc(sessionId).get();
  if (doc.exists) {
    console.log('Session exists:', doc.data());
  } else {
    console.log('Session DOES NOT exist:', sessionId);
  }
  process.exit(0);
}

inspectSession().catch(err => {
  console.error(err);
  process.exit(1);
});
