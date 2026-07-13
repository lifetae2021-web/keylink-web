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
  const q = await db.collection('users').where('phone', '==', '010-5737-3568').get();
  let guestUid;
  q.forEach(d => guestUid = d.id);
  
  if (!guestUid) return console.log('not found');
  console.log('Guest UID:', guestUid);

  // Now find the Kakao UID that belongs to her. 
  // How? She logged in, but her doc might not exist yet because of the bug!
  // Let's check Firebase Auth users for Kakao users without a firestore doc, created today!
  const listUsersResult = await admin.auth().listUsers(100);
  const today = new Date().toISOString().substring(0,10);
  
  listUsersResult.users.forEach(user => {
    if (user.uid.startsWith('kakao_') && user.metadata.creationTime.includes(today)) {
      console.log(`Kakao Auth: ${user.uid}, displayName: ${user.displayName}, created: ${user.metadata.creationTime}`);
    }
  });
}
test().catch(console.error);
