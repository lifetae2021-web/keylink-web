const fs = require('fs');
const admin = require('firebase-admin');

const envFile = fs.readFileSync('/Users/lifetae2021/Desktop/keylink/.env.local', 'utf-8');
const match = envFile.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.*)/);
if (!match) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
  process.exit(1);
}

// Remove surrounding quotes if they exist and unescape newlines
let keyString = match[1].trim();
if (keyString.startsWith('"') && keyString.endsWith('"')) {
  keyString = keyString.slice(1, -1);
} else if (keyString.startsWith("'") && keyString.endsWith("'")) {
  keyString = keyString.slice(1, -1);
}
// parse json string literal
const serviceAccount = JSON.parse(keyString.replace(/\\n/g, '\\n')); // handle escaping if needed or just parse directly

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const sessionsSnap = await db.collection('sessions')
    .where('episodeNumber', '==', 130)
    .get();
  
  if (sessionsSnap.empty) {
    console.log("No session found for episode 130");
    process.exit(0);
  }

  let overlapCount = 0;

  for (const doc of sessionsSnap.docs) {
    console.log(`\nSession ID: ${doc.id}, Region: ${doc.data().region}, Episode: 130`);
    
    // Get confirmed participants for this session
    const appsSnap = await db.collection('applications')
      .where('sessionId', '==', doc.id)
      .where('status', '==', 'confirmed')
      .get();
    
    const participants = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Found ${participants.length} confirmed participants.`);
    
    const males = participants.filter(p => p.gender === 'male' && !p.isDarkTemplar && !p.id.startsWith('dummy') && !p.userId.startsWith('user_m_'));
    const females = participants.filter(p => p.gender === 'female' && !p.isDarkTemplar && !p.id.startsWith('dummy') && !p.userId.startsWith('user_f_'));
    
    console.log(`Real Males: ${males.length}, Real Females: ${females.length}`);
    
    for (const male of males) {
      const mAppsSnap = await db.collection('applications')
        .where('userId', '==', male.userId)
        .where('status', '==', 'confirmed')
        .get();
      const mPastSessions = mAppsSnap.docs.map(d => d.data().sessionId).filter(sid => sid !== doc.id);
      
      for (const female of females) {
        const fAppsSnap = await db.collection('applications')
          .where('userId', '==', female.userId)
          .where('status', '==', 'confirmed')
          .get();
        const fPastSessions = fAppsSnap.docs.map(d => d.data().sessionId).filter(sid => sid !== doc.id);
        
        const common = mPastSessions.filter(sid => fPastSessions.includes(sid));
        if (common.length > 0) {
          const sDoc = await db.collection('sessions').doc(common[0]).get();
          const sData = sDoc.data() || {};
          const sName = `${sData.region === 'busan' ? '부산' : '창원'} ${sData.episodeNumber}기`;
          console.log(`⚠️ OVERLAP FOUND! [Male ${male.slotNumber}호 ${male.name}] <-> [Female ${female.slotNumber}호 ${female.name}] - Met in: ${sName}`);
          overlapCount++;
        }
      }
    }
  }
  if (overlapCount === 0) {
    console.log("\n✅ 130기에서는 중복 만남 대상자가 없습니다.");
  } else {
    console.log(`\n❌ 총 ${overlapCount}건의 중복 만남이 발견되었습니다.`);
  }
  process.exit(0);
}
run().catch(console.error);
