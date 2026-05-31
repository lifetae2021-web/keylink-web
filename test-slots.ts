import * as admin from 'firebase-admin';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccount = JSON.parse(serviceAccountJson!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function run() {
  const sessionId = 'OLFCcBwdN8OF7JhGmYhO';
  const snap = await db.collection('applications').where('sessionId', '==', sessionId).where('gender', '==', 'female').get();
  
  const batch = db.batch();
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.name === '김지희') {
      batch.update(doc.ref, { slotNumber: 2 });
      console.log('Moved 김지희 to 2');
    }
    if (data.name === '김채윤') {
      batch.update(doc.ref, { slotNumber: 3 });
      console.log('Moved 김채윤 to 3');
    }
    if (data.id?.startsWith('dummy') || data.userId?.startsWith('user_f_')) {
      batch.update(doc.ref, { slotNumber: null });
      console.log(`Cleared slot for dummy: ${data.name}`);
    }
  });
  
  await batch.commit();
  console.log('Successfully updated slots.');
}
run().catch(console.error);
