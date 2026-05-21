/**
 * 부산 127기 세션 카운터와 실제 신청서 수 불일치 진단 스크립트
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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key.trim()] = value;
  }
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const sessionId = 'fwoehJ0r8wFHPiMb8GOb'; // 부산 127기

  console.log(`=== 부산 127기 (${sessionId}) 카운터 진단 ===\n`);

  // 1. sessions 문서의 저장된 카운터 값 확인
  const sessionSnap = await db.doc(`sessions/${sessionId}`).get();
  const sessionData = sessionSnap.data();
  console.log('[ sessions 문서 저장된 카운터 ]');
  console.log(`  currentMale   (남성 현재): ${sessionData.currentMale}`);
  console.log(`  currentFemale (여성 현재): ${sessionData.currentFemale}`);
  console.log(`  maxMale       (남성 정원): ${sessionData.maxMale}`);
  console.log(`  maxFemale     (여성 정원): ${sessionData.maxFemale}`);

  // 2. 실제 applications 컬렉션에서 status별 인원 집계
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', sessionId)
    .get();

  const summary = {};
  appsSnap.docs.forEach(doc => {
    const d = doc.data();
    const key = `${d.gender}_${d.status}`;
    summary[key] = (summary[key] || 0) + 1;
  });

  console.log('\n[ 실제 applications 컬렉션 현황 ]');
  const statuses = ['confirmed', 'selected', 'applied', 'waitlisted', 'cancelled'];
  for (const s of statuses) {
    const m = summary[`male_${s}`] || 0;
    const f = summary[`female_${s}`] || 0;
    if (m > 0 || f > 0) console.log(`  ${s.padEnd(12)}: 남성 ${m}명, 여성 ${f}명`);
  }

  const actualMale = summary['male_confirmed'] || 0;
  const actualFemale = summary['female_confirmed'] || 0;

  console.log('\n[ 불일치 분석 ]');
  console.log(`  남성 confirmed: DB=${actualMale}명, 카운터=${sessionData.currentMale} → ${actualMale === sessionData.currentMale ? '✅ 일치' : `❌ 불일치 (차이: ${sessionData.currentMale - actualMale})`}`);
  console.log(`  여성 confirmed: DB=${actualFemale}명, 카운터=${sessionData.currentFemale} → ${actualFemale === sessionData.currentFemale ? '✅ 일치' : `❌ 불일치 (차이: ${sessionData.currentFemale - actualFemale})`}`);

  // 3. 불일치가 있으면 수정 여부 확인
  if (actualMale !== sessionData.currentMale || actualFemale !== sessionData.currentFemale) {
    console.log('\n⚠️  카운터 불일치가 감지되었습니다. 카운터를 실제 값으로 수정합니다...');
    await db.doc(`sessions/${sessionId}`).update({
      currentMale: actualMale,
      currentFemale: actualFemale,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ 수정 완료: 남성 ${actualMale}명, 여성 ${actualFemale}명으로 카운터 동기화 완료!`);
  } else {
    console.log('\n✅ 카운터가 정확합니다. 다른 원인을 확인해보세요.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
