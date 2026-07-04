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
  const usersSnap = await db.collection('users').where('name', '==', '이용수').get();
  if (usersSnap.empty) {
    console.log('User 이용수 not found');
    return;
  }
  const userId = usersSnap.docs[0].id;
  console.log('User ID:', userId);

  const sessionSnap = await db.collection('sessions').where('episodeNumber', '==', 130).get();
  const sessionId = sessionSnap.docs[0].id;
  console.log('Session ID:', sessionId);

  const votesSnap = await db.collection('votes').where('sessionId', '==', sessionId).get();
  let count = 0;
  votesSnap.docs.forEach(d => {
    const data = d.data();
    if (data.choices) {
      data.choices.forEach(c => {
        if (c.targetUserId === userId) {
          console.log(`Vote from ${data.userId}, priority: ${c.priority || c.rank}`);
          count++;
        }
      });
    }
  });

  console.log(`Total votes for 이용수 in session 130: ${count}`);
}
check().catch(console.error);
