const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function update() {
  const sessionId = 'h93In0JvH60iNEFIRrU7';
  await db.collection('sessions').doc(sessionId).update({
    title: '전문직 특집 1기',
    theme: admin.firestore.FieldValue.delete()
  });
  console.log('Successfully updated session title to 전문직 특집 1기 and removed theme');
}

update().catch(console.error).finally(() => process.exit(0));
