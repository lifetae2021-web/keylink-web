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
  console.log(`전체 회원 수: ${snapshot.size}`);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const name = data.realName || data.nickName || data.displayName || data.name || '';
    if (name.includes('리아')) {
      console.log(`Found: ${doc.id} - Name: ${name}`);
      console.log(JSON.stringify(data, null, 2));
    }
  });
}

searchUsers();
