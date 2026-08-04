const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function analyze() {
  const uids = ['kakao_4990888099', 'kakao_5007299560'];
  
  for (const uid of uids) {
    console.log(`\n============================`);
    console.log(`Analyzing UID: ${uid}`);
    console.log(`============================\n`);
    
    const docSnap = await db.collection('users').doc(uid).get();
    if (docSnap.exists) {
      console.log(`User Data: ${JSON.stringify(docSnap.data(), null, 2)}`);
    } else {
      console.log(`User document not found.`);
    }
  }
}

analyze().catch(console.error).finally(() => process.exit(0));
