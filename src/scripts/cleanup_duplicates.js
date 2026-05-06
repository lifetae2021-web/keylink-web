const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanupDuplicates() {
  console.log('--- 중복 신청 데이터 정리 시작 ---');
  const allAppsSnap = await db.collection('applications').get();
  
  const groups = {}; // sessionId_userId -> [appIds]
  
  allAppsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'confirmed' || data.status === 'selected') {
      const key = `${data.sessionId}_${data.userId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ id: doc.id, status: data.status, appliedAt: data.appliedAt });
    }
  });
  
  for (const key in groups) {
    if (groups[key].length > 1) {
      console.log(`[중복 발견] ${key}: ${groups[key].length}개`);
      // 가장 우선순위가 높은 것(confirmed > selected) 하나만 남기고 나머지는 status 변경
      groups[key].sort((a, b) => {
        if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
        if (a.status !== 'confirmed' && b.status === 'confirmed') return 1;
        return 0;
      });
      
      const [keep, ...others] = groups[key];
      console.log(`  => ID ${keep.id} 유지 (${keep.status})`);
      
      for (const other of others) {
        console.log(`  => ID ${other.id} 를 'held'로 변경`);
        await db.collection('applications').doc(other.id).update({
          status: 'held',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
  console.log('--- 정리 완료 ---');
  
  // 정리 후 카운터 다시 맞춤
  console.log('--- 카운터 최종 동기화 ---');
  const sessionsSnap = await db.collection('sessions').get();
  const freshAppsSnap = await db.collection('applications').get();
  const freshApps = freshAppsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  for (const sessionDoc of sessionsSnap.docs) {
    const sid = sessionDoc.id;
    const sessionApps = freshApps.filter(a => a.sessionId === sid && (a.status === 'confirmed' || a.status === 'selected'));
    
    // 이 시점에서는 중복이 없어야 함
    const male = sessionApps.filter(a => a.gender === 'male').length;
    const female = sessionApps.filter(a => a.gender === 'female').length;
    
    await db.collection('sessions').doc(sid).update({
      currentMale: male,
      currentFemale: female
    });
    console.log(`Session ${sid}: 남 ${male}, 여 ${female} 업데이트 완료`);
  }
}

cleanupDuplicates().catch(console.error);
