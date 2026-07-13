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
  const apps = await db.collection('applications').where('userId', '==', 'FBbQQYOvuoR46zxfZD5jAqYP0Gf2').get();
  let ns = 0;
  let td = 0;
  let pc = 0;
  apps.forEach(doc => {
    const data = doc.data();
    console.log("APP:", doc.id, "STATUS:", data.attendanceStatus);
    if (data.attendanceStatus === 'no-show') ns++;
    if (data.attendanceStatus === 'late') td++;
    if (data.attendanceStatus === 'present' || data.attendanceStatus === 'late') pc++;
  });
  console.log("Calculated NS:", ns, "TD:", td, "PC:", pc);
  
  await db.collection('users').doc('FBbQQYOvuoR46zxfZD5jAqYP0Gf2').update({
    noShowCount: ns, tardyCount: td, participationCount: pc
  });
  console.log("Updated to correct counts.");
}
test().catch(console.error);
