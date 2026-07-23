import { adminDb } from '../src/lib/firebaseAdmin';

async function checkUser() {
  const usersSnapshot = await adminDb.collection('users').where('name', '==', '우효림').get();
  
  if (usersSnapshot.empty) {
    console.log("User '우효림' not found in users collection.");
  } else {
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`User Data:`, data);
    });
  }

  const appsSnapshot = await adminDb.collection('applications').where('name', '==', '우효림').get();
  if (appsSnapshot.empty) {
    console.log("No applications found for '우효림'.");
  } else {
    appsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`App ID: ${doc.id}`);
      console.log(`App Data:`, data);
    });
  }
}

checkUser().catch(console.error);
