const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const app = initializeApp({
  projectId: "keylink-87771",
});
const db = getFirestore(app);

async function test() {
  const sessionsSnap = await getDocs(collection(db, 'sessions'));
  let total = 0;
  for (const docSnap of sessionsSnap.docs) {
    const d = docSnap.data();
    if (d.status === 'completed' && !d.isTest) {
      const summarySnap = await getDoc(doc(db, 'matchingSummaries', docSnap.id));
      if (summarySnap.exists()) {
        total += (summarySnap.data().matchedPairs || []).length;
      }
    }
  }
  console.log("Total DB couples:", total);
}
test().catch(console.error);
