const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-5e02d11e49.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const sessionId = '5Vhu0H0iVgIp7n0TarNl';

async function seedDummies() {
  console.log(`--- Seeding 16 dummies for session: ${sessionId} ---`);
  
  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  
  const jobs = ['대기업 사원', 'IT 개발자', '공공기관 대리', '전문직', '스타트업 기획자', '연구원', '금융권 주임', '의료계 종사자'];
  const locations = ['부산 진구', '부산 해운대구', '창원 성산구', '창원 의창구', '부산 수영구'];

  for (let i = 1; i <= 8; i++) {
    // 남성 더미
    const mId = `dummy_male_${i}_${Date.now()}`;
    const mRef = db.collection('applications').doc(mId);
    batch.set(mRef, {
      userId: `user_m_${i}`,
      sessionId,
      name: `더미남${i}`,
      age: 28 + Math.floor(Math.random() * 7),
      gender: 'male',
      job: jobs[Math.floor(Math.random() * jobs.length)],
      residence: locations[Math.floor(Math.random() * locations.length)],
      phone: `010-1234-567${i}`,
      status: 'confirmed',
      paymentConfirmed: true,
      appliedAt: now,
      updatedAt: now
    });

    // 여성 더미
    const fId = `dummy_female_${i}_${Date.now()}`;
    const fRef = db.collection('applications').doc(fId);
    batch.set(fRef, {
      userId: `user_f_${i}`,
      sessionId,
      name: `더미녀${i}`,
      age: 26 + Math.floor(Math.random() * 7),
      gender: 'female',
      job: jobs[Math.floor(Math.random() * jobs.length)],
      residence: locations[Math.floor(Math.random() * locations.length)],
      phone: `010-9876-543${i}`,
      status: 'confirmed',
      paymentConfirmed: true,
      appliedAt: now,
      updatedAt: now
    });
    
    // 유저 정보 보강 (투표 페이지 노출용)
    const mUserRef = db.collection('users').doc(`user_m_${i}`);
    batch.set(mUserRef, {
      name: `더미남${i}`,
      gender: 'male',
      photos: [`https://picsum.photos/seed/m${i}/200/200`]
    }, { merge: true });

    const fUserRef = db.collection('users').doc(`user_f_${i}`);
    batch.set(fUserRef, {
      name: `더미녀${i}`,
      gender: 'female',
      photos: [`https://picsum.photos/seed/f${i}/200/200`]
    }, { merge: true });
  }

  // 세션 카운트 업데이트
  const sessionRef = db.collection('sessions').doc(sessionId);
  batch.update(sessionRef, {
    currentMale: 8,
    currentFemale: 8,
    status: 'voting' // 테스트를 위해 투표 중으로 변경
  });

  await batch.commit();
  console.log('Successfully seeded 8 males and 8 females.');
  process.exit(0);
}

seedDummies().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
