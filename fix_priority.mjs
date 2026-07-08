import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';

const envConfig = fs.readFileSync('.env.local', 'utf-8');
envConfig.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    process.env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!global.adminApp) {
  global.adminApp = initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function fixPriority() {
  const sessionId = 'u0aSNeupJVv0n1OtDvQg'; // The deleted session ID
  
  const appsSnap = await db.collection('applications').where('sessionId', '==', sessionId).get();
  
  if (appsSnap.empty) {
    console.log("No applications found for session", sessionId);
    return;
  }
  
  console.log(`Found ${appsSnap.size} applications to process.`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const doc of appsSnap.docs) {
    const appData = doc.data();
    if (!appData.userId) continue;
    
    // We only process if they were applied, confirmed, or selected
    if (['applied', 'confirmed', 'selected'].includes(appData.status)) {
      const userRef = db.collection('users').doc(appData.userId);
      
      batch.update(userRef, {
        cancelledSessionHistory: FieldValue.arrayUnion({
          sessionId: sessionId,
          sessionTitle: "삭제된 7/10 기수",
          sessionDate: "07.10",
          applicationStatus: appData.status,
          cancelledAt: Timestamp.now(),
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      count++;
    }
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`Successfully added ${count} users to the priority waitlist.`);
  } else {
    console.log("No users needed updating.");
  }
}

fixPriority().catch(console.error);
