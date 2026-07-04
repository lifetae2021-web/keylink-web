const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const keyLine = env.split('\n').find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
let key = keyLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim();
if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(key)),
});
const db = admin.firestore();

async function check() {
  const userId = 'kakao_4967483382';
  const votesSnap = await db.collection('votes').get();
  
  let totalVotes = 0;
  votesSnap.docs.forEach(d => {
    const data = d.data();
    if (data.choices) {
      data.choices.forEach(c => {
        if (c.targetUserId === userId) {
          console.log(`Vote from ${data.userId} in session ${data.sessionId}`);
          totalVotes++;
        }
      });
    }
  });
  console.log('Total votes received:', totalVotes);
}
check().catch(console.error);
