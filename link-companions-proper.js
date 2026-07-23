const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    let val = value.join('=').trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    acc[key.trim()] = val;
  }
  return acc;
}, {});

try {
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.log("Could not parse service account json", e);
  process.exit(1);
}

const db = admin.firestore();

async function run() {
  const sessions = await db.collection('sessions').where('episodeNumber', '==', 134).get();
  
  if (sessions.empty) {
    console.log('Session 134 not found');
    return;
  }
  
  const sessionId134 = sessions.docs[0].id;
  console.log('Found 134 session ID:', sessionId134);

  const q1 = await db.collection('applications')
    .where('name', '==', '최은진')
    .where('sessionId', '==', sessionId134)
    .get();

  const q2 = await db.collection('applications')
    .where('name', '==', '백선미')
    .where('sessionId', '==', sessionId134)
    .get();

  let choiDoc, baekDoc;
  
  q1.docs.forEach(d => {
    if (d.data().status !== 'cancelled') {
        choiDoc = d;
    }
  });

  q2.docs.forEach(d => {
    if (d.data().status !== 'cancelled') {
        baekDoc = d;
    }
  });

  if (choiDoc && baekDoc) {
    const choiId = choiDoc.id;
    const baekId = baekDoc.id;
    
    // For Choi, partner is Baek (87)
    await db.collection('applications').doc(choiId).update({
      femaleOption: 'group',
      groupPartnerName: '백선미',
      groupPartnerBirthYear: '87'
    });
    
    // For Baek, partner is Choi (89)
    await db.collection('applications').doc(baekId).update({
      femaleOption: 'group',
      groupPartnerName: '최은진',
      groupPartnerBirthYear: '89'
    });
    
    console.log(`Successfully linked ${choiId} and ${baekId} for session ${sessionId134} using femaleOption='group'`);
  } else {
    console.log("Could not find active applications for both in session 134.");
  }
}

run().catch(console.error);
