import admin from 'firebase-admin';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountJson);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkOngoingSessions() {
  console.log('--- 현재 진행 중인 기수(Session) 목록 ---');
  
  try {
    const snapshot = await db.collection('sessions')
      .where('status', 'in', ['open', 'closed', 'voting', 'matching'])
      .get();
    
    if (snapshot.empty) {
      console.log('현재 진행 중인 세션이 없습니다.');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const eventDate = data.eventDate ? data.eventDate.toDate().toLocaleString('ko-KR') : '날짜 없음';
      console.log(`[${data.status.toUpperCase()}] ${data.title} (${data.region})`);
      console.log(` - ID: ${doc.id}`);
      console.log(` - 일시: ${eventDate}`);
      console.log(` - 정원: 남 ${data.maxMale} / 여 ${data.maxFemale}`);
      console.log(` - 신청: 남 ${data.currentMale || 0} / 여 ${data.currentFemale || 0}`);
      console.log('-----------------------------------');
    });
  } catch (error) {
    console.error('Error checking sessions:', error);
  }
}

checkOngoingSessions();
