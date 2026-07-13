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

async function test() {
  const users = await db.collection('users').get();
  for (const doc of users.docs) {
    if (JSON.stringify(doc.data()).includes('-1')) {
      console.log("USER:", doc.id, doc.data().name, doc.data().birthDate);
    }
  }
  const apps = await db.collection('applications').get();
  for (const doc of apps.docs) {
    if (JSON.stringify(doc.data()).includes('-1')) {
      console.log("APP:", doc.id, doc.data().name, doc.data().birthDate);
    }
  }
}
test().catch(console.error);
