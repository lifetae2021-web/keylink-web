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
  const appsSnap = await db.collection('applications').where('name', '==', '이수민').get();
  console.log(`Found ${appsSnap.size} applications for 이수민`);
  
  let guestUid = null;
  appsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`App: ${doc.id}, userId: ${data.userId}, isGuest: ${data.isGuestApply}`);
    if (data.isGuestApply) {
      guestUid = data.userId;
    }
  });

  if (!guestUid) return console.log("Guest UID not found");

  const guestDoc = await db.collection('users').doc(guestUid).get();
  console.log("Guest User Phone:", guestDoc.data()?.phone);

  // Now find the Kakao user recently created? We can just search all users for nickname '이수민'
  // Or we can just get the most recent users and find the Kakao one manually
  const recentUsers = await db.collection('users').orderBy('createdAt', 'desc').limit(20).get();
  recentUsers.forEach(doc => {
     if (doc.data().name === '이수민' || doc.data().displayName === '이수민' || doc.data().provider === 'kakao') {
       if (doc.data().provider === 'kakao') {
          console.log(`Recent Kakao user: ${doc.id}, name: ${doc.data().name}`);
       }
     }
  });
}
fix().catch(console.error);
