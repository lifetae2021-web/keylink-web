import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccountPath = '/Users/lifetae2021/Desktop/keylink/service-account-key.json';
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (e) {
  serviceAccount = JSON.parse(readFileSync('/Users/lifetae2021/Desktop/keylink/service-account.json', 'utf8'));
}

try {
  initializeApp({ credential: cert(serviceAccount) });
} catch (e) {
  // already initialized
}

const db = getFirestore();

async function checkUser() {
  const usersRef = db.collection('users');
  const userQuery = await usersRef.where('name', '==', '김태욱').get();
  
  if (userQuery.empty) {
    console.log("No user found named 김태욱");
    return;
  }
  
  const userDocs = userQuery.docs;
  for (const userDoc of userDocs) {
    console.log(`User ID: ${userDoc.id}`);
    
    const appsRef = db.collection('applications');
    const appsQuery = await appsRef.where('userId', '==', userDoc.id).get();
    
    console.log(`Applications: ${appsQuery.docs.length}`);
    for (const doc of appsQuery.docs) {
      const data = doc.data();
      
      let sessionData = {};
      try {
         const sessionDoc = await db.collection('sessions').doc(data.sessionId).get();
         if (sessionDoc.exists) {
           sessionData = sessionDoc.data();
         }
      } catch (e) {}

      console.log(`\nApp ID: ${doc.id}`);
      console.log(`Session ID: ${data.sessionId}`);
      console.log(`Session Title: ${sessionData.title}`);
      console.log(`Status: ${data.status}`);
      console.log(`Prices in App:`, {
        price: data.price,
        maleOption: data.maleOption,
        femaleOption: data.femaleOption,
        couponDiscount: data.couponDiscount,
        amountPaid: data.amountPaid
      });
      console.log(`Prices in Session:`, {
        price: sessionData.price,
        malePrice: sessionData.malePrice,
        maleSafePrice: sessionData.maleSafePrice,
        originalPrice: sessionData.originalPrice
      });
    }
  }
}

checkUser();
