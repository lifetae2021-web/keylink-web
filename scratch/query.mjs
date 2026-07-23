import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "keylink-web-2caf2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "users"), where("name", "==", "서영주"));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log(doc.id, " => ", doc.data());
  });
}
run();
