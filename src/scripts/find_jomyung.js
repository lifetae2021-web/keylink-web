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
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.includes('조명')) {
      console.log('ID:', doc.id);
      console.log('photos:', data.photos);
      console.log('profilePhotos:', data.profilePhotos);
      console.log('facePhotos:', data.facePhotos);
      console.log('bodyPhotos:', data.bodyPhotos);
    }
  });
}

run().catch(console.error);
