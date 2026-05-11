const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const uid = 'ic1mQd7M3geFFpWw5R3D0DD5JYS2';

async function deepCheck() {
  console.log('--- [1] User Document Deep Scan ---');
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    console.log(JSON.stringify(userDoc.data(), null, 2));
  } else {
    console.log('User document not found.');
  }

  console.log('\n--- [2] Applications Scan ---');
  const appSnapshot = await db.collection('applications').where('userId', '==', uid).get();
  if (appSnapshot.empty) {
    console.log('No applications found for this user.');
  } else {
    appSnapshot.forEach(doc => {
      console.log(`Application ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
}

deepCheck();
