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
  const targetName = '이창일';
  console.log(`Firestore에서 '${targetName}' 회원 검색 중...`);

  const snapshot = await db.collection('users')
    .where('name', '==', targetName)
    .get();

  if (snapshot.empty) {
    console.log(`'${targetName}' 회원을 찾을 수 없습니다. (혹시 닉네임이나 다른 이름으로 가입했는지 확인 필요)`);
    return;
  }

  console.log(`총 ${snapshot.size}명의 '${targetName}' 회원이 발견되었습니다:`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('--------------------------------------------------');
    console.log(`이름: ${data.name}`);
    console.log(`아이디(이메일): ${data.email || '이메일 없음'}`);
    console.log(`전화번호: ${data.phone || '전화번호 없음'}`);
    console.log(`가입기수(메모 등): ${data.memo || '메모 없음'}`);
    console.log(`UID: ${doc.id}`);
    
    // 임시 비밀번호 설정
    const tempPassword = 'key1234!';
    console.log(`\nUID: ${doc.id} 회원 비밀번호를 '${tempPassword}'로 재설정하는 중...`);
    
    try {
      await admin.auth().updateUser(doc.id, {
        password: tempPassword
      });
      console.log(`✅ 비밀번호 강제 업데이트 완료!`);
    } catch (authError) {
      console.error(`❌ Auth 업데이트 실패 (사용자가 Auth에 존재하지 않거나 연동 방식 다름):`, authError.message);
    }
  }
  console.log('--------------------------------------------------');
}

findAndResetUser().catch(err => {
  console.error(err);
  process.exit(1);
});
