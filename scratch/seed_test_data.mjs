import admin from 'firebase-admin';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountJson);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const SESSION_IDS = [
  'session-120',
  'Rx6tF7Z8g9RHjgHmiRie', // 125기
  '5Vhu0H0iVgIp7n0TarNl'  // 000기
];

const MALE_NAMES = ['김철수', '이영희', '박지성', '최민호', '정우성'];
const FEMALE_NAMES = ['김태희', '이지은', '박신혜', '최수영', '한가인'];

async function seedTestData() {
  console.log('--- 테스트 데이터 생성 시작 ---');

  for (const sessionId of SESSION_IDS) {
    console.log(`기수 ID: ${sessionId} 작업 중...`);
    
    for (let i = 1; i <= 2; i++) {
      // 남성 2명
      const mUid = `test_male_${sessionId}_${i}`;
      const mName = MALE_NAMES[i-1];
      await db.collection('users').doc(mUid).set({
        name: mName,
        gender: 'male',
        phone: '01012345678', // 테스트번호
        birthDate: '940101',
        workplace: '테스트 컴퍼니',
      });
      
      await db.collection('applications').add({
        userId: mUid,
        sessionId: sessionId,
        name: mName,
        age: 32,
        gender: 'male',
        job: '개발자',
        phone: '01012345678',
        status: 'applied',
        paymentConfirmed: false,
        appliedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        price: 49000
      });

      // 여성 2명
      const fUid = `test_female_${sessionId}_${i}`;
      const fName = FEMALE_NAMES[i-1];
      await db.collection('users').doc(fUid).set({
        name: fName,
        gender: 'female',
        phone: '01087654321', // 테스트번호
        birthDate: '960505',
        workplace: '디자인 스튜디오',
      });

      await db.collection('applications').add({
        userId: fUid,
        sessionId: sessionId,
        name: fName,
        age: 30,
        gender: 'female',
        job: '디자이너',
        phone: '01087654321',
        status: 'applied',
        paymentConfirmed: false,
        appliedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        price: 29000
      });
    }
  }

  console.log('--- 테스트 데이터 생성 완료! ---');
}

seedTestData().catch(console.error);
