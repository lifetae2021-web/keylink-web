import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const serviceAccount = JSON.parse(serviceAccountJson!);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

async function run() {
  const snap = await db.collection('users').get();
  const results: any[] = [];
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    const avoid = data.avoidAcquaintance || data.avoidAcquaintances;
    if (avoid && avoid.trim() !== '') {
      results.push({
        id: doc.id,
        name: data.name,
        phone: data.phone,
        avoid: avoid
      });
    }
  });
  
  console.log(JSON.stringify(results, null, 2));
}
run().catch(console.error);
