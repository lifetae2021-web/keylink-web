const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const keyLine = env.split('\n').find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
let key = keyLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim();
if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(key)),
});
const db = admin.firestore();

async function check() {
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', 'NYSAQDVLTAba8I1vEKfn') // Wait, 131 session is NYSAQDVLTAba8I1vEKfn according to the screenshot url
    .where('status', '==', 'confirmed')
    .get();
    
  for (const doc of appsSnap.docs) {
    const data = doc.data();
    if (data.name === '임재영' || data.name === '류민희') {
      console.log('App:', data.name, 'Drink (app):', data.drink);
      const u = await db.collection('users').doc(data.userId).get();
      console.log('User:', u.data().name, 'Drink (user):', u.data().drink);
    }
  }
}
check().catch(console.error);
