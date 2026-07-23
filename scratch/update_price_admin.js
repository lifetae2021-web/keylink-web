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
    const appsSnap = await db.collection('applications')
      .where('sessionId', '==', '1BvpZ0nlKWgcSlw3efVa')
      .where('name', '==', '최은진')
      .get();

    if (appsSnap.empty) {
      console.log('최은진님의 신청서를 찾을 수 없습니다.');
      return;
    }

    const appDoc = appsSnap.docs[0];
    const appId = appDoc.id;
    console.log(`Found application for 최은진. Doc ID: ${appId}`);
    
    await db.collection('applications').doc(appId).update({
      price: 19000
    });

    console.log('최은진님의 결제 금액을 19,000원으로 성공적으로 업데이트했습니다.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
