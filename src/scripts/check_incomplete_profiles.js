const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function scanProfiles() {
  const snapshot = await db.collection('users').get();
  const incompleteUsers = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    // 필수 프로필 항목 중 하나라도 비어있는 경우 체크
    const isMissing = !data.job || !data.company || !data.residence;
    
    if (isMissing) {
      incompleteUsers.push({
        uid: doc.id,
        name: data.realName || data.name || data.nickName || '이름없음',
        email: data.email,
        provider: data.provider || 'unknown',
        missingFields: [
          !data.job && 'job',
          !data.company && 'company',
          !data.residence && 'residence',
          !data.education && 'education'
        ].filter(Boolean)
      });
    }
  });

  console.log(`--- 전체 회원(${snapshot.size}명) 중 미작성 의심 회원: ${incompleteUsers.length}명 ---`);
  console.log(JSON.stringify(incompleteUsers, null, 2));
}

scanProfiles();
