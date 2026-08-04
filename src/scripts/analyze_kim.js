const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function analyze() {
  const names = ['강동근', 'ㄱㄷㄱ'];
  
  for (const name of names) {
    console.log(`\n============================`);
    console.log(`Analyzing: ${name}`);
    console.log(`============================\n`);
    
    console.log(`--- [1] users collection ---`);
    const usersSnap = await db.collection('users').where('name', '==', name).get();
    if (usersSnap.empty) {
      console.log('No user found.');
    } else {
      usersSnap.forEach(doc => {
        const d = doc.data();
        console.log(`User ID: ${doc.id}`);
        console.log(`Phone: ${d.phone}`);
        console.log(`Gender/Age: ${d.gender} / ${d.age} / ${d.birthYear || d.birthDate}`);
        console.log(`CreatedAt: ${d.createdAt ? d.createdAt.toDate().toLocaleString() : 'N/A'}`);
        console.log(`Raw Data: ${JSON.stringify(d, null, 2)}`);
      });
    }
    
    console.log(`\n--- [2] applications collection ---`);
    const appsSnap = await db.collection('applications').where('name', '==', name).get();
    if (appsSnap.empty) {
      console.log('No applications found.');
    } else {
      appsSnap.forEach(doc => {
        const d = doc.data();
        console.log(`App ID: ${doc.id}`);
        console.log(`Session ID: ${d.sessionId}`);
        console.log(`Status: ${d.status}`);
        console.log(`Payment: ${d.paymentConfirmed} / Price: ${d.price}`);
        console.log(`Raw Data: ${JSON.stringify(d, null, 2)}`);
      });
    }
  }
}

analyze().catch(console.error).finally(() => process.exit(0));
