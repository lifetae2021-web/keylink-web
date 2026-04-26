/**
 * Firestore 기수 관련 데이터 전체 삭제 스크립트
 * 대상: sessions, applications, votes, matchingResults
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// .env.local 직접 파싱
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) {
    console.log(`  [${collectionName}] 비어있음 (스킵)`);
    return 0;
  }

  const BATCH_SIZE = 400;
  let deleted = 0;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, docs.length - i);
  }

  console.log(`  [${collectionName}] ${deleted}개 삭제 완료`);
  return deleted;
}

async function main() {
  console.log('=== Firestore 기수 데이터 정리 시작 ===\n');

  const targets = ['sessions', 'applications', 'votes', 'matchingResults', 'matchingSummaries'];
  let total = 0;

  for (const col of targets) {
    total += await deleteCollection(col);
  }

  console.log(`\n=== 완료: 총 ${total}개 문서 삭제 ===`);
  process.exit(0);
}

main().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
