import { adminDb } from '../src/lib/firebaseAdmin';

async function syncAvoidList() {
  try {
    const appsSnap = await adminDb.collection('applications').get();
    
    let updatedCount = 0;
    const batch = adminDb.batch();
    
    for (const doc of appsSnap.docs) {
      const appData = doc.data();
      
      const appAvoidList = appData.avoidList || [];
      const appLegacyAvoid = appData.avoidAcquaintance || '';
      
      if (appAvoidList.length > 0 || appLegacyAvoid) {
        const userId = appData.userId;
        if (!userId) continue;
        
        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
          const userData = userDoc.data() || {};
          const userAvoidList = userData.avoidList || [];
          const userLegacyAvoid = userData.avoidAcquaintance || '';
          
          let needsUpdate = false;
          const updates: any = {};
          
          // Sync avoidList if missing or empty in user but present in application
          if (appAvoidList.length > 0 && userAvoidList.length === 0) {
            updates.avoidList = appAvoidList;
            needsUpdate = true;
          }
          
          // Sync avoidAcquaintance if missing in user but present in application
          if (appLegacyAvoid && !userLegacyAvoid) {
            updates.avoidAcquaintance = appLegacyAvoid;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            batch.update(userRef, updates);
            updatedCount++;
            console.log(`Will update user ${userData.name} (${userId}) with avoidList data.`);
          }
        }
      }
    }
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Successfully synced avoidList for ${updatedCount} users.`);
    } else {
      console.log('No users needed avoidList syncing.');
    }
    
  } catch (err) {
    console.error('Error syncing avoidList:', err);
  }
}

syncAvoidList();
