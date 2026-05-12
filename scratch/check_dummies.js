
const { adminDb } = require('./src/lib/firebaseAdmin');

async function checkDummies() {
  const snapshot = await adminDb.collection('users').get();
  const dummies = snapshot.docs.filter(doc => {
    const data = doc.data();
    return doc.id.startsWith('dummy_') || doc.id.startsWith('user_m_') || doc.id.startsWith('user_f_') || data.isDummy === true;
  });
  
  console.log(`Total users: ${snapshot.size}`);
  console.log(`Dummy users: ${dummies.length}`);
  if (dummies.length > 0) {
    console.log('Sample dummy ID:', dummies[0].id);
  }
}

checkDummies();
