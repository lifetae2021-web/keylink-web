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

async function link() {
  const oldUid = 'lfzNTDLvO6XKq4gtWJKliKfNF763'; // guest UID
  const newUid = 'kakao_4986056845'; // kakao UID

  const oldDoc = await db.collection('users').doc(oldUid).get();
  if (!oldDoc.exists) {
    return console.log("Old doc doesn't exist");
  }
  const oldData = oldDoc.data();
  console.log("Merging data for:", oldData.name);

  const batch = db.batch();
  
  // Move applications
  const appsSnap = await db.collection('applications').where('userId', '==', oldUid).get();
  let appCount = 0;
  appsSnap.forEach(appDoc => {
    batch.update(appDoc.ref, { userId: newUid });
    appCount++;
  });
  console.log(`Moving ${appCount} applications`);

  // Move user profile info
  const newRef = db.collection('users').doc(newUid);
  // Get Kakao's current name to potentially keep it
  const newDoc = await newRef.get();
  const kakaoName = newDoc.exists ? newDoc.data().name : '';

  const mergedData = { 
    ...oldData, 
    uid: newUid, 
    isRegistered: true, 
    loginMethod: 'kakao', 
    provider: 'kakao', 
    role: 'user', 
    updatedAt: new Date() 
  };
  
  // Keep original name from form
  if (oldData.name) mergedData.name = oldData.name;
  
  batch.set(newRef, mergedData, { merge: true });
  
  // Mark old as merged
  batch.update(db.collection('users').doc(oldUid), { mergedTo: newUid });

  await batch.commit();
  console.log("Successfully linked accounts!");
}
link().catch(console.error);
