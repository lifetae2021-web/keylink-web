/**
 * 부산 125기 남성 참가자 대상 2차 SMS 보냄 상태 소급 적용 스크립트
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// .env.local 로드
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    let value = rest.join('=').trim();
    // 감싸진 따옴표 제거
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key.trim()] = value;
  }
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  const sessionId = 'CXMVgSiFMxS4eVAsoqg3'; // 부산 125기
  console.log(`=== 부산 125기(세션 ID: ${sessionId}) 남성 2차 SMS 상태 소급 적용 시작 ===\n`);

  // 1. applications 에서 해당 세션의 신청서 중 남성이며 참가 확정(confirmed)인 사람 목록 조회
  const q = db.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('gender', '==', 'male')
    .where('status', '==', 'confirmed');

  const snap = await q.get();

  if (snap.empty) {
    console.log('소급 적용 대상 신청서를 찾을 수 없습니다.');
    process.exit(0);
  }

  console.log(`총 ${snap.docs.length}명의 남성 참가 확정자가 검색되었습니다.`);
  let updatedCount = 0;

  const batch = db.batch();
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    // 이미 secondSmsSentAt이 들어가 있다면 건너뛰거나 강제 갱신
    if (!data.secondSmsSentAt) {
      console.log(`- [소급 대상] ${data.name} (ID: ${doc.id}) -> secondSmsSentAt 설정`);
      batch.update(doc.ref, {
        secondSmsSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      updatedCount++;
    } else {
      console.log(`- [이미 완료] ${data.name} (ID: ${doc.id}) -> 이미 발송 일시가 존재함 (건너뜀)`);
    }
  });

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`\n=== 성공: 총 ${updatedCount}명의 남성 참가자 신청서에 2차 SMS 발송 기록이 소급 적용되었습니다! ===`);
  } else {
    console.log('\n=== 소급 적용할 대상이 없습니다 (모두 이미 완료 상태). ===');
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
