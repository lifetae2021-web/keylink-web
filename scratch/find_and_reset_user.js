const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. .env.local 로드
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let serviceAccountKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
    serviceAccountKey = line.substring('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim();
    if ((serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
        (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))) {
      serviceAccountKey = serviceAccountKey.substring(1, serviceAccountKey.length - 1);
    }
  }
});

if (!serviceAccountKey) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(serviceAccountKey);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error('Failed to parse service account key:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function findAndResetUser() {
  const targetName = '서가희';
  console.log(`Firestore에서 '${targetName}' 신청자 검색 중...`);

  const snapshot = await db.collection('applications')
    .where('name', '==', targetName)
    .get();

  if (snapshot.empty) {
    console.log(`'${targetName}' 신청자를 찾을 수 없습니다.`);
    return;
  }

  console.log(`총 ${snapshot.size}건의 신청 내역이 발견되었습니다:`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('--------------------------------------------------');
    console.log(`이름: ${data.name}`);
    console.log(`기수: ${data.sessionId}`);
    console.log(`상태: ${data.status}`);
    console.log(`노쇼: ${data.attendanceStatus === 'no-show' ? 'O' : 'X'}`);
    
    try {
      await db.collection('applications').doc(doc.id).update({
        status: 'confirmed',
        isManualRefund: true,
        attendanceStatus: null, // 노쇼 해제
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ 상태 복구 처리 완료! (confirmed, isManualRefund: true)`);
    } catch (error) {
      console.error(`❌ 업데이트 실패:`, error.message);
    }
  }
  console.log('--------------------------------------------------');
}

findAndResetUser().catch(err => {
  console.error(err);
  process.exit(1);
});
