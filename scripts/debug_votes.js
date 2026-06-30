const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    let value = rest.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key.trim()] = value;
  }
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const sessionId = 'I3TLJx8jGRr4GCDzZNeV';

  const apps = await db.collection('applications').where('sessionId', '==', sessionId).get();
  console.log(`Found ${apps.size} applications`);
  const participants = [];
  apps.forEach(d => {
    const p = d.data();
    participants.push(p);
  });

  const votes = await db.collection('votes').where('sessionId', '==', sessionId).get();
  console.log(`Found ${votes.size} votes`);
  
  votes.forEach(d => {
    const v = d.data();
    if (v.userId && v.userId.startsWith('system_')) return; // ignore fake votes
    console.log(`Vote ID: ${d.id} | UserID: ${v.userId} | Name: ${v.realName || v.name} | isManual: ${v.isManualReview} | Feedback: ${v.feedback}`);
  });
  
  console.log("----- Target Users -----");
  ['김병준', '김우진', '송은비'].forEach(name => {
    const p = participants.find(x => x.name === name);
    if (!p) console.log(`${name} not found in participants`);
    else {
      console.log(`${name}: userId=${p.userId}, gender=${p.gender}, slotNumber=${p.slotNumber}`);
    }
  });
  
  process.exit(0);
}
main().catch(console.error);
