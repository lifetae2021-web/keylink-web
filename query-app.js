const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
  });
}

const db = admin.firestore();

async function check() {
  try {
    const snapshot = await db.collection('applications')
      .where('name', '==', '박지송')
      .get();
      
    if (snapshot.empty) {
      console.log('No matching documents for 박지송.');
      return;
    }  

    snapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
  } catch (err) {
    console.error('Error:', err);
  }
}
check();
