const admin = require('firebase-admin');
const fs = require('fs');

let serviceAccountPath = '/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json';
if (!fs.existsSync(serviceAccountPath)) {
  serviceAccountPath = '/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-5e02d11e49.json';
}
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function main() {
  try {
    // Get 133기 session
    const sessionsSnap = await db.collection('sessions').where('episodeNumber', '==', 133).get();
    if (sessionsSnap.empty) {
      console.log('133기 세션 찾을 수 없음');
      return;
    }
    const sessionDoc = sessionsSnap.docs[0];
    const sessionData = sessionDoc.data();
    console.log(`[133기 세션 정보]`);
    console.log(`ID: ${sessionDoc.id}`);
    console.log(`targetMaleAge: ${sessionData.targetMaleAge}`);
    
    // Get Jin Seong-min application
    const appsSnap = await db.collection('applications')
      .where('sessionId', '==', sessionDoc.id)
      .where('name', '==', '진성민')
      .get();
      
    if (appsSnap.empty) {
      console.log('진성민 신청서 찾을 수 없음');
      return;
    }
    const appDoc = appsSnap.docs[0];
    const appData = appDoc.data();
    console.log(`\n[진성민 신청 정보]`);
    console.log(`birthDate: ${appData.birthDate}`);
    console.log(`gender: ${appData.gender}`);
    console.log(`userId: ${appData.userId}`);

    // Get Jin Seong-min user profile
    const userDoc = await db.collection('users').doc(appData.userId).get();
    const userData = userDoc.data();
    console.log(`\n[진성민 유저 정보]`);
    console.log(`birthDate: ${userData?.birthDate}`);
    console.log(`birthYear: ${userData?.birthYear}`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
