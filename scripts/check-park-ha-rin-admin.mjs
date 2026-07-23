import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env vars to get project ID, but for admin we can usually just initialize if we have credentials or are in the right environment, 
// or we can just read the service account from .env if needed. Since we are local, let's try default initialization first.
// If that fails, we can read the env.
try {
  admin.initializeApp();
} catch (e) {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) {
      acc[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
    }
    return acc;
  }, {});

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: envVars.FIREBASE_PROJECT_ID,
      clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
      // Handle escaped newlines in private key
      privateKey: envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function checkUserLogs() {
  const usersRef = db.collection('users');
  const q = usersRef.where('name', '==', '박하린');
  const userSnap = await q.get();
  
  if (userSnap.empty) {
    console.log('User 박하린 not found');
    return;
  }

  for (const doc of userSnap.docs) {
    const userData = doc.data();
    console.log(`User found: ${userData.name} (ID: ${doc.id})`);
    console.log(`visitCount in user doc: ${userData.visitCount}`);
    console.log(`createdAt in user doc: ${userData.createdAt?.toDate?.() || userData.createdAt}`);

    const logsRef = db.collection('visitor_logs');
    const logsQ = logsRef.where('userId', '==', doc.id);
    const logsSnap = await logsQ.get();
    
    console.log(`Found ${logsSnap.size} visitor logs for ${userData.name}`);
    
    logsSnap.docs.forEach((logDoc, index) => {
      const logData = logDoc.data();
      console.log(`Log ${index + 1}: ${logData.timestamp?.toDate?.() || logData.timestamp} - ${logData.path}`);
    });
  }
}

checkUserLogs().catch(console.error);
