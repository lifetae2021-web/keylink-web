const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function inspect124() {
  const sessionId = 'pXhjj9LPNKenp5R91QGp'; // 부산 124기
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .get();
  
  console.log('--- 부산 124기 유효 신청자(confirmed/selected) 명단 ---');
  appsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'confirmed' || data.status === 'selected') {
      console.log(`[${data.status}] ${data.gender === 'male' ? '남' : '여'} - 이름: ${data.userName || '알수없음'}, ID: ${doc.id}`);
    }
  });
}

inspect124().catch(console.error);
