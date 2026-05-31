const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // assuming standard path, or use initializeApp without args if env vars are set
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}
const db = admin.firestore();

async function run() {
  const sessionId = 'OLFCCBwdN8OF7JhGmYhO'; // from the URL in screenshot: session=OLFCCBwdN8OF7JhGmYhO
  const snap = await db.collection('applications').where('sessionId', '==', sessionId).where('gender', '==', 'female').get();
  console.log(`Found ${snap.docs.length} female applications for session ${sessionId}`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}, Name: ${data.name}, Status: ${data.status}, Slot: ${data.slotNumber}, Dummy: ${data.id?.startsWith('dummy') || data.userId?.startsWith('user_f_')}`);
  });
}
run().catch(console.error);
