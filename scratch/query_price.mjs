import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "keylink-web-2caf2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  try {
    const sessionsRef = collection(db, 'sessions');
    let sessionSnap = await getDocs(query(sessionsRef, where('episodeNumber', '==', 134)));
    if (sessionSnap.empty) {
      sessionSnap = await getDocs(query(sessionsRef, where('episodeNumber', '==', '134')));
    }
    
    if (sessionSnap.empty) {
      console.log('134기 세션을 찾을 수 없습니다.');
      return;
    }

    const sessionId = sessionSnap.docs[0].id;
    console.log(`134기 세션 ID: ${sessionId}`);

    const appsSnap = await getDocs(query(
      collection(db, 'applications'),
      where('sessionId', '==', sessionId),
      where('name', 'in', ['백선미', '최은진', '우효림'])
    ));

    appsSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`\n이름: ${data.name}`);
      console.log(`결제금액 (price): ${data.price}`);
      console.log(`옵션 (femaleOption): ${data.femaleOption}`);
      console.log(`쿠폰 할인 (couponDiscount): ${data.couponDiscount}`);
      console.log(`쿠폰명 (couponTitle): ${data.couponTitle}`);
      console.log(`상태: ${data.status}`);
      console.log(`기본금액이 맞는지? sessionType: ${data.sessionType}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
