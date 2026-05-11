const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function searchUsers() {
  const snapshot = await db.collection('users').get();
  snapshot.forEach(doc => {
    const d = doc.data();
    const name = d.realName || d.name || d.nickName || d.displayName || '';
    if (name.includes('양수정')) {
      console.log(`Found User: ${doc.id} - Name: ${name}`);
      console.log(JSON.stringify(d, null, 2));
    }
  });
}

searchUsers();
