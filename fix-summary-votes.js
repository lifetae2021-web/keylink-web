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

async function fix() {
  const summariesSnap = await db.collection('matchingSummaries').get();
  
  for (const docSnap of summariesSnap.docs) {
    const sessionId = docSnap.id;
    const data = docSnap.data();
    
    // Check if there are any votes from system_... for this session
    const votesSnap = await db.collection('votes').where('sessionId', '==', sessionId).get();
    let hasSystemVotes = false;
    let systemVoteTargets = [];
    
    votesSnap.docs.forEach(vDoc => {
      const vData = vDoc.data();
      if (vData.userId && vData.userId.startsWith('system_')) {
        hasSystemVotes = true;
        if (vData.choices) {
          vData.choices.forEach(c => {
            systemVoteTargets.push(c.targetUserId);
          });
        }
      }
    });

    if (hasSystemVotes && data.voteCountMap) {
      console.log(`Fixing session ${sessionId}...`);
      const newVoteCountMap = { ...data.voteCountMap };
      for (const targetId of systemVoteTargets) {
        if (newVoteCountMap[targetId]) {
          newVoteCountMap[targetId]--;
          if (newVoteCountMap[targetId] <= 0) {
            delete newVoteCountMap[targetId];
          }
        }
      }
      await db.collection('matchingSummaries').doc(sessionId).update({
        voteCountMap: newVoteCountMap
      });
      console.log(`Updated voteCountMap for session ${sessionId}`);
    }
  }
}
fix().catch(console.error);
