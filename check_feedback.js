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
  const feedbacksSnap = await db.collection('feedbacks').where('sessionId', '==', sessionId).get();
  console.log(`Total feedbacks found for session ${sessionId}: ${feedbacksSnap.docs.length}`);
  
  feedbacksSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}, Name: ${data.name}, Feedback: ${data.feedback}`);
  });
  
  // Also check if she submitted feedback but maybe under a different collection, or in 'applications'?
  const appsSnap = await db.collection('applications').where('sessionId', '==', sessionId).get();
  appsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.name === '송은비') {
      console.log(`Found application for 송은비: ID=${doc.id}, Feedback: ${data.feedback}, hasFeedback: ${data.hasFeedback}, Status: ${data.status}`);
    }
  });

  process.exit(0);
}
run().catch(console.error);
