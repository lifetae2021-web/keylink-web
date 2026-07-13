const fs = require('fs');
const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n');
envConfig.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1];
    let value = match[2];
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value;
  }
});
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  console.log('Fetching visitor logs...');
  const logsSnap = await db.collection('visitor_logs').get();
  console.log(`Found ${logsSnap.size} visitor logs.`);

  const userVisits = {};

  logsSnap.forEach(doc => {
    const data = doc.data();
    if (!data.userId) return; // Only count authenticated visits

    const uid = data.userId;
    // timestamp might be Firestore Timestamp or a string/number
    let date;
    if (data.timestamp && data.timestamp.toDate) {
      date = data.timestamp.toDate();
    } else if (data.timestamp) {
      date = new Date(data.timestamp);
    } else {
      date = new Date(); // fallback
    }

    // Generate a unique string for the year, month, day, and hour
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;

    if (!userVisits[uid]) {
      userVisits[uid] = new Set();
    }
    userVisits[uid].add(dateKey);
  });

  const uids = Object.keys(userVisits);
  console.log(`Found ${uids.length} unique users with visit history.`);

  let updatedCount = 0;
  let batch = db.batch();
  let operations = 0;

  for (const uid of uids) {
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    
    if (snap.exists) {
      const visitCount = userVisits[uid].size;
      batch.update(userRef, { 
        visitCount: visitCount
      });
      updatedCount++;
      operations++;

      if (operations % 400 === 0) {
        await batch.commit();
        console.log(`Committed ${operations} updates...`);
        batch = db.batch();
      }
    }
  }

  if (operations % 400 !== 0 && operations > 0) {
    await batch.commit();
  }

  console.log(`Successfully backfilled visit counts for ${updatedCount} valid users.`);
}

run().catch(console.error).finally(() => process.exit(0));
