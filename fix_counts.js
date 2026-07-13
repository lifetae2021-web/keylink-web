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
  const users = await db.collection('users').get();
  let count = 0;
  for (const doc of users.docs) {
    const data = doc.data();
    let updates = {};
    if (data.noShowCount < 0) updates.noShowCount = 0;
    if (data.tardyCount < 0) updates.tardyCount = 0;
    if (data.participationCount < 0) updates.participationCount = 0;
    
    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      count++;
      console.log(`Fixed user ${doc.id}`);
    }
  }
  console.log(`Fixed ${count} users`);
}

fix().catch(console.error);
