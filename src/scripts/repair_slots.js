const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-5e02d11e49.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function repairSlots() {
  const sessionId = 'SoqWRpHeQjr3pLuOQhxo';
  console.log(`--- Session ${sessionId} slotNumber repair started ---`);
  
  try {
    const appsSnap = await db.collection('applications')
      .where('sessionId', '==', sessionId)
      .where('status', '==', 'confirmed')
      .get();
      
    const apps = appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const males = apps.filter(a => a.gender === 'male')
      .sort((a, b) => {
        // Sort by slotNumber first, then appliedAt to be deterministic
        const slotA = a.slotNumber || 999;
        const slotB = b.slotNumber || 999;
        if (slotA !== slotB) return slotA - slotB;
        
        const timeA = a.appliedAt?.toMillis?.() || 0;
        const timeB = b.appliedAt?.toMillis?.() || 0;
        return timeA - timeB;
      });
      
    const females = apps.filter(a => a.gender === 'female')
      .sort((a, b) => {
        const slotA = a.slotNumber || 999;
        const slotB = b.slotNumber || 999;
        if (slotA !== slotB) return slotA - slotB;
        
        const timeA = a.appliedAt?.toMillis?.() || 0;
        const timeB = b.appliedAt?.toMillis?.() || 0;
        return timeA - timeB;
      });

    console.log('\nMale assignment list:');
    for (let i = 0; i < males.length; i++) {
      const app = males[i];
      const newSlot = i + 1;
      console.log(`  * ${app.name}: Old slot = ${app.slotNumber} -> New slot = ${newSlot}`);
      await db.collection('applications').doc(app.id).update({
        slotNumber: newSlot,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log('\nFemale assignment list:');
    for (let i = 0; i < females.length; i++) {
      const app = females[i];
      const newSlot = i + 1;
      console.log(`  * ${app.name}: Old slot = ${app.slotNumber} -> New slot = ${newSlot}`);
      await db.collection('applications').doc(app.id).update({
        slotNumber: newSlot,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Also repair counters in session to match the total confirmed count
    await db.collection('sessions').doc(sessionId).update({
      currentMale: males.length,
      currentFemale: females.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`\nCounters updated: currentMale = ${males.length}, currentFemale = ${females.length}`);
    console.log('--- Slot repair successfully completed ---');
  } catch (error) {
    console.error('Error during slot repair:', error);
  } finally {
    process.exit(0);
  }
}

repairSlots();
