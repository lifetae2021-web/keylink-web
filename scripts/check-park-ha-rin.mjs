import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    acc[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
  }
  return acc;
}, {});

const firebaseConfig = {
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUserLogs() {
  // Find user "박하린"
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('name', '==', '박하린'));
  const userSnap = await getDocs(q);
  
  if (userSnap.empty) {
    console.log('User 박하린 not found');
    return;
  }

  for (const doc of userSnap.docs) {
    const userData = doc.data();
    console.log(`User found: ${userData.name} (ID: ${doc.id})`);
    console.log(`visitCount in user doc: ${userData.visitCount}`);
    console.log(`createdAt in user doc: ${userData.createdAt?.toDate?.() || userData.createdAt}`);

    // Check visitor_logs for this user
    const logsRef = collection(db, 'visitor_logs');
    const logsQ = query(logsRef, where('userId', '==', doc.id));
    const logsSnap = await getDocs(logsQ);
    
    console.log(`Found ${logsSnap.size} visitor logs for ${userData.name}`);
    
    logsSnap.docs.forEach((logDoc, index) => {
      const logData = logDoc.data();
      console.log(`Log ${index + 1}: ${logData.timestamp?.toDate?.() || logData.timestamp} - ${logData.path}`);
    });
  }
}

checkUserLogs().catch(console.error);
