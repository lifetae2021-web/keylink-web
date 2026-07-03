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
  const q = await db.collection('votes').get();
  console.log(`Total votes in DB: ${q.docs.length}`);
  
  let foundSongEunBi = false;
  q.docs.forEach(doc => {
    const data = doc.data();
    if (data.name === '송은비' || data.realName === '송은비') {
      console.log(`FOUND 송은비! SessionID: ${data.sessionId}, VoteID: ${doc.id}, Feedback: ${data.feedback}`);
      foundSongEunBi = true;
    }
  });

  if (!foundSongEunBi) {
    console.log("송은비 not found in votes collection.");
    
    // check applications collection for 송은비
    const appsQ = await db.collection('applications').where('name', '==', '송은비').get();
    appsQ.docs.forEach(doc => {
      console.log(`FOUND 송은비 in applications! SessionID: ${doc.data().sessionId}, AppID: ${doc.id}, Status: ${doc.data().status}`);
    });
  }

  process.exit(0);
}
run().catch(console.error);
