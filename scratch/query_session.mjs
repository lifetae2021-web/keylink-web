import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "keylink-web-2caf2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  try {
    const sessionSnap = await getDoc(doc(db, 'sessions', '1BvpZ0nlKWgcSlw3efVa'));
    console.log(sessionSnap.data());
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
