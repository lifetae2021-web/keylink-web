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
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkKim() {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('name', '==', '김태욱'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log('No user named 김태욱');
      process.exit(0);
    }
    
    for (const d of snap.docs) {
      console.log('User:', d.id, d.data().name, d.data().gender, d.data().birthDate);
      
      const appsRef = collection(db, 'applications');
      const appsQ = query(appsRef, where('userId', '==', d.id));
      const appsSnap = await getDocs(appsQ);
      
      for (const appDoc of appsSnap.docs) {
        const appData = appDoc.data();
        let sessionData = {};
        try {
          const sessionSnap = await getDoc(doc(db, 'sessions', appData.sessionId));
          if (sessionSnap.exists()) {
            sessionData = sessionSnap.data();
          }
        } catch (e) {}

        console.log(`\nApp ID: ${appDoc.id} (Session: ${appData.sessionId} - ${sessionData.title})`);
        console.log('App Status:', appData.status);
        console.log('App Price Info:', {
          price: appData.price,
          amountPaid: appData.amountPaid,
          maleOption: appData.maleOption,
          femaleOption: appData.femaleOption,
          couponDiscount: appData.couponDiscount
        });
        console.log('Session Price Info:', {
          price: sessionData.price,
          malePrice: sessionData.malePrice,
          maleSafePrice: sessionData.maleSafePrice,
          originalPrice: sessionData.originalPrice
        });
      }
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkKim();
