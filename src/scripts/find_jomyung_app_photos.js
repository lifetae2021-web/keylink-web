const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(
  fs.readFileSync('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  console.log('Searching applications matching "조명"...');
  const appsSnap = await db.collection('applications').get();
  appsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.includes('조명')) {
      console.log('--- APPLICATION ---');
      console.log('ID:', doc.id);
      console.log('photos:', data.photos);
    }
  });

  console.log('Searching private_applications matching "조명"...');
  const privateAppsSnap = await db.collection('private_applications').get();
  privateAppsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.includes('조명')) {
      console.log('--- PRIVATE APPLICATION ---');
      console.log('ID:', doc.id);
      console.log('photos:', data.photos);
    }
  });
}

run().catch(console.error);
