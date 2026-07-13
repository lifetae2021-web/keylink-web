const admin = require('firebase-admin');
const fs = require('fs');

const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n');
envConfig.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1];
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value;
  }
});

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fix() {
  const recentUsers = await db.collection('users').orderBy('createdAt', 'desc').limit(20).get();
  recentUsers.forEach(doc => {
     console.log(`User: ${doc.id}, name: ${doc.data().name}, displayName: ${doc.data().displayName}, provider: ${doc.data().provider}, phone: ${doc.data().phone}, created: ${doc.data().createdAt?.toDate()}`);
  });
}
fix().catch(console.error);
