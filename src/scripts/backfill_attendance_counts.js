/**
 * backfill_attendance_counts.js
 *
 * 기존 기수에서 노쇼·지각으로 기록된 모든 application을 조회하여
 * 해당 유저의 noShowCount / tardyCount를 정확히 계산해 반영(소급 적용).
 *
 * 실행: node src/scripts/backfill_attendance_counts.js
 * 필수: Firebase Admin SDK 서비스 계정 키
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backfill() {
  console.log('🔍 Scanning all applications for no-show / late status...\n');

  // 1. noShowCount 집계용 Map
  const noShowMap = {}; // userId → count
  const tardyMap  = {}; // userId → count

  // 2. attendanceStatus = 'no-show' 인 신청서 전수 조회
  const nsSnap = await db
    .collection('applications')
    .where('attendanceStatus', '==', 'no-show')
    .get();

  console.log(`  Found ${nsSnap.size} no-show application(s)`);
  for (const d of nsSnap.docs) {
    const uid = d.data().userId;
    // 더미 계정 제외
    if (!uid || uid.startsWith('user_m_') || uid.startsWith('user_f_')) continue;
    noShowMap[uid] = (noShowMap[uid] || 0) + 1;
  }

  // 3. attendanceStatus = 'late' 인 신청서 전수 조회
  const ltSnap = await db
    .collection('applications')
    .where('attendanceStatus', '==', 'late')
    .get();

  console.log(`  Found ${ltSnap.size} late application(s)`);
  for (const d of ltSnap.docs) {
    const uid = d.data().userId;
    if (!uid || uid.startsWith('user_m_') || uid.startsWith('user_f_')) continue;
    tardyMap[uid] = (tardyMap[uid] || 0) + 1;
  }

  // 4. 대상 유저 목록 통합
  const allUids = new Set([...Object.keys(noShowMap), ...Object.keys(tardyMap)]);
  console.log(`\n👤 Unique users to update: ${allUids.size}\n`);

  // 5. Batch write (500개 제한 대응)
  let batch = db.batch();
  let batchCount = 0;
  let totalUpdated = 0;

  for (const uid of allUids) {
    const ns = noShowMap[uid] || 0;
    const td = tardyMap[uid] || 0;

    const userRef = db.collection('users').doc(uid);
    batch.set(userRef, { noShowCount: ns, tardyCount: td }, { merge: true });
    batchCount++;
    totalUpdated++;

    console.log(`  ✏️  ${uid} → noShow: ${ns}, tardy: ${td}`);

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`  💾 Batch committed (${batchCount} writes)`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  💾 Final batch committed (${batchCount} writes)`);
  }

  // 6. 결과 리포트
  console.log('\n════════════════════════════════════════');
  console.log(`✅ Backfill complete!`);
  console.log(`   Total no-show records : ${nsSnap.size}`);
  console.log(`   Total late records     : ${ltSnap.size}`);
  console.log(`   Users updated          : ${totalUpdated}`);
  console.log('════════════════════════════════════════\n');

  process.exit(0);
}

backfill().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
