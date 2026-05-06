const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkUser() {
  const name = '테스트일반투';
  console.log(`Checking user: ${name}`);
  
  const snap = await db.collection('users').where('name', '==', name).get();
  if (snap.empty) {
    console.log('❌ User not found in users collection');
    return;
  }
  
  snap.forEach(doc => {
    console.log('✅ User found!');
    console.log('ID:', doc.id);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });
}

checkUser().catch(console.error);
