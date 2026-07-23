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
      where('name', 'in', ['백선미', '최은진'])
    ));

    appsSnap.docs.forEach(doc => {
      console.log(`\n--- ${doc.data().name} ---`);
      console.log(doc.data());
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
