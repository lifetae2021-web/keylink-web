const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function auditProfiles() {
  const userSnapshot = await db.collection('users').get();
  const results = {
    totalUsers: userSnapshot.size,
    completelyEmpty: [], // 회원정보X, 신청서X
    syncNeeded: [],      // 회원정보X, 신청서O (신청서엔 정보 있음)
    appOnly: []          // 회원정보X, 신청서O (신청서에도 정보 없음)
  };

  for (const userDoc of userSnapshot.docs) {
    const userData = userDoc.data();
    if (!userData.job || !userData.company) {
      const uid = userDoc.id;
      const name = userData.realName || userData.name || userData.nickName || '이름없음';
      
      // 해당 유저의 신청서 확인
      const appSnapshot = await db.collection('applications').where('userId', '==', uid).get();
      
      if (appSnapshot.empty) {
        results.completelyEmpty.push({ name, email: userData.email, provider: userData.provider });
      } else {
        let foundInApp = false;
        appSnapshot.forEach(appDoc => {
          const appData = appDoc.data();
          if (appData.job || appData.company || appData.occupation) {
            foundInApp = true;
          }
        });

        if (foundInApp) {
          results.syncNeeded.push({ name, email: userData.email, appIdCount: appSnapshot.size });
        } else {
          results.appOnly.push({ name, email: userData.email });
        }
      }
    }
  }

  console.log(`=== 프로필 감사 결과 (총 ${results.totalUsers}명) ===`);
  console.log(`1. 정보 완전 누락 (가입만 함): ${results.completelyEmpty.length}명`);
  console.log(`2. 동기화 필요 (신청서엔 정보 있음!): ${results.syncNeeded.length}명`);
  console.log(`3. 신청서는 썼으나 정보 없음: ${results.appOnly.length}명`);
  
  if (results.syncNeeded.length > 0) {
    console.log('\n--- [!] 동기화가 필요한 회원 리스트 ---');
    console.log(JSON.stringify(results.syncNeeded, null, 2));
  }
  
  if (results.completelyEmpty.length > 0) {
    console.log('\n--- 가입만 하고 활동 없는 회원 (상위 5명) ---');
    console.log(JSON.stringify(results.completelyEmpty.slice(0, 5), null, 2));
  }
}

auditProfiles();
