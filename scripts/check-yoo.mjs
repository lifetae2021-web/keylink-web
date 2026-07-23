import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
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
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkYoo() {
  try {
    const appsRef = collection(db, 'applications');
    const q = query(appsRef, where('name', '==', '유관우'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log('No applications found for 유관우');
      process.exit(0);
    }
    
    console.log(`Found ${snap.docs.length} applications for 유관우:\n`);
    
    for (const d of snap.docs) {
      const data = d.data();
      console.log(`App ID: ${d.id}`);
      console.log(`User ID: ${data.userId}`);
      console.log(`Session ID: ${data.sessionId}`);
      console.log(`Applied At: ${data.appliedAt?.toDate()}`);
      
      const userSnap = await getDoc(doc(db, 'users', data.userId));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log(`User Info: isRegistered=${userData.isRegistered}, authProvider=${userData.authProvider || 'none'}`);
      } else {
        console.log(`User Doc Not Found for ${data.userId}`);
      }
      console.log('---');
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkYoo();
