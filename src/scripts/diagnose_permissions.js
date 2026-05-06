const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function diagnose() {
  console.log('--- 시스템 권한 진단 시작 ---');
  
  // 1. sessions 읽기 테스트
  try {
    const sessions = await db.collection('sessions').limit(1).get();
    console.log('✅ sessions 컬렉션 읽기 성공');
  } catch (e) {
    console.error('❌ sessions 컬렉션 읽기 실패:', e.message);
  }

  // 2. applications 읽기 테스트
  try {
    const apps = await db.collection('applications').limit(1).get();
    console.log('✅ applications 컬렉션 읽기 성공');
  } catch (e) {
    console.error('❌ applications 컬렉션 읽기 실패:', e.message);
  }

  console.log('--- 진단 완료 ---');
}

diagnose().catch(console.error);
