const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function finalAudit() {
  const sid = 'pXhjj9LPNKenp5R91QGp'; // 부산 124기
  const appsSnap = await db.collection('applications').where('sessionId', '==', sid).get();
  
  console.log('--- 부산 124기 확정/선발자 명단 (전수조사) ---');
  for (const doc of appsSnap.docs) {
    const data = doc.data();
    if (data.status === 'confirmed' || data.status === 'selected') {
      const userSnap = await db.collection('users').doc(data.userId).get();
      const userName = userSnap.exists ? userSnap.data().name : '유저정보없음';
      console.log(`[${data.status}] ${data.gender === 'male' ? '남' : '여'} - 앱ID: ${doc.id}, 유저ID: "${data.userId}", 이름: ${userName}`);
    }
  }
}

finalAudit().catch(console.error);
