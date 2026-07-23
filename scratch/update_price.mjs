import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "keylink-web-2caf2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  try {
    const appsSnap = await getDocs(query(
      collection(db, 'applications'),
      where('sessionId', '==', '1BvpZ0nlKWgcSlw3efVa'),
      where('name', '==', '최은진')
    ));

    if (appsSnap.empty) {
      console.log('최은진님의 신청서를 찾을 수 없습니다.');
      return;
    }

    const appDoc = appsSnap.docs[0];
    const appId = appDoc.id;
    console.log(`Found application for 최은진. Doc ID: ${appId}`);
    
    await updateDoc(doc(db, 'applications', appId), {
      price: 19000
    });

    console.log('최은진님의 결제 금액을 19,000원으로 성공적으로 업데이트했습니다.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
