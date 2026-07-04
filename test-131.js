const admin = require('firebase-admin');

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
});

const db = admin.firestore();

async function check131() {
  const sessionSnap = await db.collection('sessions').where('episodeNumber', '==', 131).get();
  if (sessionSnap.empty) {
    console.log('No 131 session found');
    return;
  }
  const sessionDoc = sessionSnap.docs[0];
  const sessionId = sessionDoc.id;
  const sessionData = sessionDoc.data();
  console.log('Session Title:', sessionData.title);
  console.log('maxMale:', sessionData.maxMale, 'maxFemale:', sessionData.maxFemale);
  
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('status', '==', 'confirmed')
    .get();
    
  console.log('Confirmed apps:', appsSnap.size);
  const male = [];
  const female = [];
  for (const doc of appsSnap.docs) {
    const data = doc.data();
    if (data.gender === 'male') male.push(data);
    else female.push(data);
  }
  
  console.log('Male slots:', male.map(a => a.slotNumber).sort((a,b)=>a-b));
  console.log('Female slots:', female.map(a => a.slotNumber).sort((a,b)=>a-b));
}
check131().catch(console.error);
