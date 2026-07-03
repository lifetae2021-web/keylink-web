const { adminDb } = require('./src/lib/firebaseAdmin');

async function test() {
  const snap = await adminDb.collection('matchingSummaries').get();
  let total = 0;
  snap.docs.forEach(d => {
    total += (d.data().matchedPairs || []).length;
  });
  console.log("TOTAL_DB_COUPLES=" + total);
}
test().catch(console.error);
