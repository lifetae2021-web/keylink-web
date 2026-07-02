require('dotenv').config({ path: '../../.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const snap = await usersRef.where('name', '==', '박재원').get();
  if (snap.empty) {
    console.log('No user found named 박재원');
    return;
  }
  snap.forEach(async doc => {
    console.log('User found:', doc.id, doc.data().name);
    const appSnap = await db.collection('applications').where('userId', '==', doc.id).get();
    console.log(`Found ${appSnap.size} applications in 'applications' collection.`);
    appSnap.forEach(appDoc => console.log('App:', appDoc.id, appDoc.data()));
  });
}
run();
