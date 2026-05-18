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

async function migratePrivatePhotos() {
  console.log('Starting migration of photos from private_applications to users...');
  const privateAppsSnap = await db.collection('private_applications').get();
  let updatedCount = 0;

  for (const docSnap of privateAppsSnap.docs) {
    const appData = docSnap.data();
    if (appData.userId && Array.isArray(appData.photos) && appData.photos.length > 0) {
      const userRef = db.collection('users').doc(appData.userId);
      const userSnap = await userRef.get();
      
      if (userSnap.exists) {
        const userData = userSnap.data();
        const existingPhotos = [
          ...(Array.isArray(userData.photos) ? userData.photos : []),
          ...(Array.isArray(userData.profilePhotos) ? userData.profilePhotos : []),
          ...(Array.isArray(userData.facePhotos) ? userData.facePhotos : [])
        ].filter(Boolean);

        if (existingPhotos.length === 0) {
          console.log(`Migrating ${appData.photos.length} photos for user ${appData.userId} (${userData.name})...`);
          await userRef.update({
            photos: appData.photos
          });
          updatedCount++;
        }
      }
    }
  }

  console.log(`Migration complete! Updated ${updatedCount} users.`);
}

migratePrivatePhotos().catch(console.error);
