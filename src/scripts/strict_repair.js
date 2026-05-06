const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function strictRepair() {
  console.log('--- 참가 확정(confirmed) 인원 기준 전수 교정 시작 ---');
  const sessionsSnap = await db.collection('sessions').get();
  const appsSnap = await db.collection('applications').get();
  const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  for (const sessionDoc of sessionsSnap.docs) {
    const sid = sessionDoc.id;
    // 오직 'confirmed' 상태만 집계
    const confirmedApps = apps.filter(a => a.sessionId === sid && a.status === 'confirmed');
    
    // 중복 사용자 제거
    const uniqueUserIds = new Set();
    const uniqueApps = [];
    for (const app of confirmedApps) {
      if (!uniqueUserIds.has(app.userId)) {
        uniqueUserIds.add(app.userId);
        uniqueApps.push(app);
      }
    }
    
    const male = uniqueApps.filter(a => a.gender === 'male').length;
    const female = uniqueApps.filter(a => a.gender === 'female').length;
    
    await db.collection('sessions').doc(sid).update({
      currentMale: male,
      currentFemale: female
    });
    console.log(`[${sessionDoc.data().region} ${sessionDoc.data().episodeNumber}기] 남 ${male}, 여 ${female} (확정자 기준 업데이트)`);
  }
  console.log('--- 교정 완료 ---');
}

strictRepair().catch(console.error);
