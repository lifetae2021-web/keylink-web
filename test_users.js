const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function run() {
  const db = admin.firestore();
  const snapshot = await db.collection('users')
    .where('name', 'in', ['test02', 'test03'])
    .get();
  
  snapshot.forEach(doc => {
    console.log('ID:', doc.id);
    console.log('Data:', doc.data());
    console.log('---');
  });
}
run();
