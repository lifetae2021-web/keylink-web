import { adminDb } from '../src/lib/firebaseAdmin';

async function fixUser() {
  const uid = 'kakao_4954767688';
  const appId = 'A95xgly1yfgmY6WRjqQp';
  
  await adminDb.collection('users').doc(uid).update({
    height: "159",
    weight: "50"
  });
  console.log("Updated users collection.");

  await adminDb.collection('applications').doc(appId).update({
    height: "159",
    weight: "50"
  });
  console.log("Updated applications collection.");
}

fixUser().catch(console.error);
