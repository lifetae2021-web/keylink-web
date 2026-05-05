const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkData() {
  console.log('--- Latest 3 Users ---');
  const uSnap = await db.collection('users').orderBy('createdAt', 'desc').limit(3).get();
  uSnap.forEach(d => console.log(d.id, d.data().name, d.data().status, d.data().createdAt?.toDate?.(), d.data().timestamp?.toDate?.()));

  console.log('\n--- Latest 3 Applications ---');
  const aSnap = await db.collection('applications').orderBy('appliedAt', 'desc').limit(3).get();
  aSnap.forEach(d => console.log(d.id, d.data().name, d.data().status, d.data().appliedAt?.toDate?.()));

  console.log('\n--- Latest 3 Private Applications ---');
  const pSnap = await db.collection('private_applications').orderBy('createdAt', 'desc').limit(3).get();
  pSnap.forEach(d => console.log(d.id, d.data().name, d.data().status, d.data().createdAt?.toDate?.()));
}

checkData();
