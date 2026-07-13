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
  users.forEach(d => {
    const bd = d.data().birthDate;
    if (bd && bd.includes('-1')) {
      console.log("USER", d.id, bd);
    }
  });

  const apps = await db.collection('applications').get();
  apps.forEach(d => {
    const bd = d.data().birthDate;
    if (bd && bd.includes('-1')) {
      console.log("APP", d.id, bd);
    }
  });
}
test().catch(console.error);
