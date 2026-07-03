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
  const sessionId = 'I3TLjx8jGRr4GCDzZNeV';
  const votesSnap = await db.collection('votes').where('sessionId', '==', sessionId).get();
  console.log(`Total votes for session ${sessionId}: ${votesSnap.docs.length}`);
  
  votesSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.name === '송은비' || (data.feedback && data.feedback.length > 0)) {
      console.log(`ID: ${doc.id}, Name: ${data.name || data.realName}, Feedback: ${data.feedback}, FeedbackLength: ${data.feedback?.length}`);
    }
  });

  process.exit(0);
}
run().catch(console.error);
