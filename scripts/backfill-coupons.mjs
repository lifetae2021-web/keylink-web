/**
 * 웰컴 쿠폰 누락 회원 일괄 발급 스크립트
 * node scripts/backfill-coupons.mjs
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env.local 수동 파싱
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function backfillCoupons() {
  console.log('🔍 쿠폰 누락 회원 조회 중...');

  const usersSnap = await db.collection('users').where('isRegistered', '==', true).get();

  const now = new Date();
  const expireAt = new Date(now);
  expireAt.setMonth(expireAt.getMonth() + 3);

  let issuedCount = 0;
  let skippedCount = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();

    // 병합된(비활성) 계정 스킵
    if (data.mergedTo) { skippedCount++; continue; }

    // 이미 쿠폰 있는 회원 스킵
    const couponsSnap = await db.collection('users').doc(uid).collection('coupons').limit(1).get();
    if (!couponsSnap.empty) {
      console.log(`  ⏭️  [스킵] ${data.name || uid} - 이미 쿠폰 있음`);
      skippedCount++;
      continue;
    }

    // 쿠폰 발급
    await db.collection('users').doc(uid).collection('coupons').add({
      title: '웰컴 가입 축하 쿠폰',
      type: 'amount',
      value: 5000,
      isUsed: false,
      createdAt: now,
      expireAt,
      note: '쿠폰 누락 회원 일괄 발급 (백필)',
    });

    console.log(`  ✅ [발급] ${data.name || uid}`);
    issuedCount++;
  }

  console.log(`\n🎁 완료! 발급: ${issuedCount}명 / 스킵: ${skippedCount}명`);
  process.exit(0);
}

backfillCoupons().catch(e => {
  console.error('❌ 오류:', e);
  process.exit(1);
});
