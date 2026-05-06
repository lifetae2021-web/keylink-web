const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deepInspect() {
  const appIds = [
    '9wcfa1WQMuKz9GKLUkR3', 'E1MtWKrE5PTPDDVhyDVK', 'Q40q49lv4vMwsctJdFJJ',
    'c4yqPNdkxqHTCMGxVRuo', 'cNls63q4CC4mnbIFufaK', 'm4os75ysWnH1oGFxK9XB',
    'pAj6tJ9jITWsb1lwvJvq', 'rbyqhMt5hfntFbLVIsu5'
  ];
  
  console.log('--- 124기 유효 신청서 상세 분석 ---');
  for (const id of appIds) {
    const snap = await db.collection('applications').doc(id).get();
    const data = snap.data();
    const userSnap = await db.collection('users').doc(data.userId).get();
    const userData = userSnap.exists ? userSnap.data() : null;
    
    console.log(`ID: ${id}`);
    console.log(`  상태: ${data.status}, 성별: ${data.gender}`);
    console.log(`  신청서상 이름: ${data.userName || '(없음)'}`);
    console.log(`  실제 유저 이름: ${userData ? userData.name : '(유저데이터없음)'}`);
    console.log(`  유저 ID: ${data.userId}`);
  }
}

deepInspect().catch(console.error);
