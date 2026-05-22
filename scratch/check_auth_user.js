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

async function checkAuthUser() {
  const uid = 'XeIkDlHR93XEpaVDvYNZMRhBh3r2';
  console.log(`Firebase Auth에서 UID '${uid}' 조회 중...`);
  
  try {
    const userRecord = await admin.auth().getUser(uid);
    console.log('--------------------------------------------------');
    console.log('Firebase Auth 정보:');
    console.log(`UID: ${userRecord.uid}`);
    console.log(`이메일: ${userRecord.email || '이메일 없음'}`);
    console.log(`전화번호: ${userRecord.phoneNumber || 'Auth에 전화번호 없음'}`);
    console.log(`가입 제공자 (Providers):`);
    userRecord.providerData.forEach((provider) => {
      console.log(`  - Provider ID: ${provider.providerId}`);
      console.log(`    이메일: ${provider.email || '없음'}`);
      console.log(`    UID (Federated): ${provider.uid}`);
    });
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('Auth 조회 실패:', error.message);
  }
}

checkAuthUser().catch(err => {
  console.error(err);
  process.exit(1);
});
