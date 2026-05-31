import * as admin from 'firebase-admin';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccount = JSON.parse(serviceAccountJson!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function run() {
  const sessions = await db.collection('sessions').where('episodeNumber', '==', 128).get();
  if (sessions.empty) {
    console.log('No session 128 found');
    return;
  }
  const sessionDoc = sessions.docs[0];
  console.log(`Found session 128 with ID: ${sessionDoc.id}`);
  
  const snap = await db.collection('applications').where('sessionId', '==', sessionDoc.id).where('gender', '==', 'female').get();
  console.log(`Found ${snap.docs.length} female applications for session ${sessionDoc.id}`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}, Name: ${data.name}, Status: ${data.status}, Slot: ${data.slotNumber}, Dummy: ${data.id?.startsWith('dummy') || data.userId?.startsWith('user_f_')}`);
  });
}
run().catch(console.error);
