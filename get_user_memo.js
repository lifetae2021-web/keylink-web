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

const admin = require('firebase-admin');

if (!admin.apps.length) {
  let saStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}';
  saStr = saStr.replace(/\\n/g, '\\n'); // Keep escaped newlines for JSON.parse
  const serviceAccount = JSON.parse(saStr);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const q = db.collection('users').where('name', '==', '김준하');
  const snap = await q.get();
  snap.forEach(doc => {
    console.log('User:', doc.id);
    const data = doc.data();
    console.log('adminMemo:', data.adminMemo);
    console.log('memo:', data.memo);
    console.log('penalty:', data.penalty);
    console.log('warnings:', data.warnings);
    console.log('status:', data.status);
    console.log('isBanned:', data.isBanned);
    console.log('banReason:', data.banReason);
  });

  const appQ = db.collection('applications').where('name', '==', '김준하');
  const appSnap = await appQ.get();
  appSnap.forEach(doc => {
    console.log('App:', doc.id);
    const data = doc.data();
    console.log('app adminMemo:', data.adminMemo);
    console.log('app memo:', data.memo);
    console.log('status:', data.status);
    console.log('isBlacklisted:', data.isBlacklisted);
  });
}
main().catch(console.error).finally(() => process.exit(0));
