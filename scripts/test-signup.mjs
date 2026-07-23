import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local
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
const auth = getAuth(app);
const db = getFirestore(app);

async function testSignup() {
  try {
    console.log('Attempting signup...');
    const userCredential = await createUserWithEmailAndPassword(auth, 'test_signup_bug@keylink.user', 'password123');
    const user = userCredential.user;
    console.log('Auth success:', user.uid);

    console.log('Attempting Firestore write...');
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      username: 'test_signup_bug',
      name: '테스트',
      gender: 'male',
      phone: '010-9999-9999',
      birthDate: '990101',
      role: 'user',
      provider: 'email',
    });
    console.log('Firestore write success!');
    process.exit(0);
  } catch (error) {
    console.error('Error during signup test:', error.code, error.message);
    process.exit(1);
  }
}

testSignup();
