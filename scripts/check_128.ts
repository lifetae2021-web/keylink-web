import * as admin from 'firebase-admin';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const q = await db.collection('sessions').where('episodeNumber', '==', 128).get();
  if (q.empty) {
    console.log("128기 세션을 찾을 수 없습니다.");
    return;
  }
  const sessionDoc = q.docs[0];
  const sessionData = sessionDoc.data();
  console.log("128기 status:", sessionData.status);
  console.log("128기 isTest 설정:", sessionData.isTest);

  const appsQ = await db.collection('applications').where('sessionId', '==', sessionDoc.id).where('name', '==', '이가현').get();
  appsQ.forEach(d => {
    console.log("이가현 신청서:", d.data().name, d.data().userId, "상태:", d.data().status);
  });
  process.exit(0);
}
check();
