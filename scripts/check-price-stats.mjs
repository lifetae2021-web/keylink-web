import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) acc[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const app = initializeApp({
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function check() {
  const q = query(collection(db, 'applications'), where('gender', '==', 'male'), limit(20));
  const snap = await getDocs(q);
  console.log('Recent male applications prices:');
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`Name: ${data.name}, Session: ${data.sessionId}, Price: ${data.price}`);
  });
  process.exit(0);
}
check();
