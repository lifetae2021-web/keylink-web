const fs = require('fs');
const admin = require('firebase-admin');

const envFile = fs.readFileSync('/Users/lifetae2021/Desktop/keylink/.env.local', 'utf-8');
const match = envFile.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.*)/);
let keyString = match[1].trim();
if (keyString.startsWith('"') && keyString.endsWith('"')) keyString = keyString.slice(1, -1);
else if (keyString.startsWith("'") && keyString.endsWith("'")) keyString = keyString.slice(1, -1);
const serviceAccount = JSON.parse(keyString.replace(/\\n/g, '\\n'));

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const sessionsSnap = await db.collection('sessions').get();
  let updatedCount = 0;
  
  const batch = db.batch();
  for (const doc of sessionsSnap.docs) {
    const data = doc.data();
    if (data.voteConfig && data.voteConfig.feedbackHelpText && data.voteConfig.feedbackHelpText.includes('밑거름이 됩니다')) {
      batch.update(doc.ref, { 'voteConfig.feedbackHelpText': '* 작성해주신 후기는 익명으로 소중하게 보관됩니다.' });
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    await batch.commit();
    console.log(`Updated ${updatedCount} sessions with the new anonymous feedback text.`);
  } else {
    console.log('No sessions needed updating in DB.');
  }
  process.exit(0);
}
run().catch(console.error);
