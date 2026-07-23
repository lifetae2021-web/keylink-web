import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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
      where('name', 'in', ['백선미', '최은진', '우효림'])
    ));

    appsSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`\n이름: ${data.name}`);
      console.log(`결제금액: ${data.price}`);
      console.log(`옵션: ${data.femaleOption}`);
      console.log(`신청일시: ${data.appliedAt ? data.appliedAt.toDate().toLocaleString() : 'N/A'}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
