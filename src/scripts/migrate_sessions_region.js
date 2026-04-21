const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateSessions() {
  console.log('--- Sessions Region Migration Started ---');
  const sessionRef = db.collection('sessions');
  const snapshot = await sessionRef.get();

  if (snapshot.empty) {
    console.log('No sessions found.');
    return;
  }

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.region) {
      batch.update(doc.ref, { region: 'busan' });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully updated ${count} sessions to 'busan'.`);
  } else {
    console.log('All sessions already have a region field.');
  }
  
  console.log('--- Migration Finished ---');
  process.exit(0);
}

migrateSessions().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
