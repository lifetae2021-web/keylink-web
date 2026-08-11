const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findUser() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('name', '==', 'ㅁㄱ이이').get();
  
  if (snapshot.empty) {
    console.log('No matching documents for name ㅁㄱ이이');
    return;
  }  

  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

findUser().catch(console.error);
