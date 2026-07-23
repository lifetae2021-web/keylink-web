const { adminDb } = require('./src/lib/firebaseAdmin');

async function test() {
  const usersRef = adminDb.collection('users');
  const q = usersRef.where('name', '==', '박하린');
  const userSnap = await q.get();
  
  if (userSnap.empty) {
    console.log('User 박하린 not found');
    return;
  }

  for (const doc of userSnap.docs) {
    const userData = doc.data();
    console.log(`User found: ${userData.name} (ID: ${doc.id})`);
    console.log(`visitCount in user doc: ${userData.visitCount}`);
    console.log(`createdAt in user doc: ${userData.createdAt?.toDate?.() || userData.createdAt}`);

    const logsRef = adminDb.collection('visitor_logs');
    const logsQ = logsRef.where('userId', '==', doc.id);
    const logsSnap = await logsQ.get();
    
    console.log(`Found ${logsSnap.size} visitor logs for ${userData.name}`);
    
    logsSnap.docs.forEach((logDoc, index) => {
      const logData = logDoc.data();
      console.log(`Log ${index + 1}: ${logData.timestamp?.toDate?.() || logData.timestamp} - ${logData.path}`);
    });
  }
}

test().catch(console.error);
