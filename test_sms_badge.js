const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function test() {
  const appsRef = db.collection('applications');
  const snapshot = await appsRef.limit(1).get();
  if (snapshot.empty) {
    console.log('No documents found.');
    return;
  }
  
  const doc = snapshot.docs[0];
  await doc.ref.update({
    isSmsSent: true,
    lastSmsSentAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`Updated document ${doc.id} with SMS info!`);
}

test().catch(console.error);
