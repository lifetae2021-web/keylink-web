const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: "keylink-87771",
  appId: "1:221081699913:web:75ffc50dc87e68c187514a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const snap = await getDocs(collection(db, 'matchingSummaries'));
  let total = 0;
  snap.docs.forEach(d => {
    total += (d.data().matchedPairs || []).length;
  });
  console.log("Total matched pairs in matchingSummaries:", total);
}
test().catch(console.log);
