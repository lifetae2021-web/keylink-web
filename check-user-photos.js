const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const env = fs.readFileSync('.env.local', 'utf-8');
const keyLine = env.split('\n').find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
let key = keyLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim();
if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);
if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
const serviceAccount = JSON.parse(key);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  const users = await db.collection('users').where('name', '==', '노은섬').get();
  if (users.empty) {
    console.log('User not found');
    return;
  }
  const u = users.docs[0].data();
  console.log('ID:', users.docs[0].id);
  console.log('photos:', u.photos);
  console.log('profileImages:', u.profileImages);
  console.log('images:', u.images);
  console.log('photoUrl:', u.photoUrl);
  console.log('profileUrl:', u.profileUrl);
}
check().catch(console.error);
