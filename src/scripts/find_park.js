const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const snap = await usersRef.where('name', '==', '박재원').get();
  if (snap.empty) {
    console.log('No user found');
    return;
  }
  snap.forEach(async doc => {
    console.log('User found:', doc.id, doc.data().name);
    const appSnap = await db.collection('applications').where('userId', '==', doc.id).get();
    console.log(`Found ${appSnap.size} applications in 'applications' collection.`);
    appSnap.forEach(appDoc => console.log('App:', appDoc.id, appDoc.data()));
    
    const pAppSnap = await db.collection('private_applications').where('userId', '==', doc.id).get();
    console.log(`Found ${pAppSnap.size} applications in 'private_applications' collection.`);
    pAppSnap.forEach(appDoc => console.log('Private App:', appDoc.id, appDoc.data()));
  });
}
run();
