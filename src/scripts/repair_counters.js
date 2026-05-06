const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function repairSessionCounters() {
  console.log('--- 기수별 인원 카운트 정밀 점검 및 복구 시작 ---');
  
  const sessionsSnap = await db.collection('sessions').get();
  const allAppsSnap = await db.collection('applications').get();
  
  const apps = allAppsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  for (const sessionDoc of sessionsSnap.docs) {
    const sessionId = sessionDoc.id;
    const sessionData = sessionDoc.data();
    
    // 해당 기수의 실제 유효한(확정 또는 입금대기) 신청자 계산
    const validApps = apps.filter(a => 
      a.sessionId === sessionId && 
      (a.status === 'confirmed' || a.status === 'selected')
    );
    
    // 중복 사용자 제거 (한 명의 사용자가 같은 기수에 여러 확정/선발 상태를 가질 수 없으므로)
    const uniqueUserIds = new Set();
    const uniqueApps = [];
    
    for (const app of validApps) {
      if (!uniqueUserIds.has(app.userId)) {
        uniqueUserIds.add(app.userId);
        uniqueApps.push(app);
      }
    }
    
    const realMaleCount = uniqueApps.filter(a => a.gender === 'male').length;
    const realFemaleCount = uniqueApps.filter(a => a.gender === 'female').length;
    
    if (sessionData.currentMale !== realMaleCount || sessionData.currentFemale !== realFemaleCount) {
      console.log(`[수정 필요] ${sessionData.region} ${sessionData.episodeNumber}기 (${sessionId})`);
      console.log(`  - 남성: 현재 ${sessionData.currentMale} -> 실제 ${realMaleCount}`);
      console.log(`  - 여성: 현재 ${sessionData.currentFemale} -> 실제 ${realFemaleCount}`);
      
      await db.collection('sessions').doc(sessionId).update({
        currentMale: realMaleCount,
        currentFemale: realFemaleCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  => 수정 완료`);
    }
  }
  
  console.log('--- 복구 작업 완료 ---');
}

repairSessionCounters().catch(console.error);
