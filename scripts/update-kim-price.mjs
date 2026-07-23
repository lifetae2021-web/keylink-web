import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
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

async function fixPrices() {
  try {
    // 1. Update Session 133 (6COS9J7XNcARDn2Z0TJq)
    const sessionRef = doc(db, 'sessions', '6COS9J7XNcARDn2Z0TJq');
    await updateDoc(sessionRef, {
      malePrice: 49000
    });
    console.log('✅ Session 133 malePrice updated to 49000');

    // 2. Update Kim Tae-wook's application for this session
    const appsRef = collection(db, 'applications');
    const q = query(appsRef, where('name', '==', '김태욱'), where('sessionId', '==', '6COS9J7XNcARDn2Z0TJq'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log('❌ No applications found for 김태욱 in Session 133');
    } else {
      for (const d of snap.docs) {
        await updateDoc(d.ref, {
          price: 49000
        });
        console.log(`✅ Application ${d.id} (김태욱) price updated to 49000`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating prices:', error);
    process.exit(1);
  }
}

fixPrices();
