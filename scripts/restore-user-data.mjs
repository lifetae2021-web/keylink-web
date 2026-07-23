import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    let val = value.join('=').trim();
    if (key.trim() !== 'FIREBASE_SERVICE_ACCOUNT_KEY') {
       val = val.replace(/['"]/g, '');
    } else {
       if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
       else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    }
    acc[key.trim()] = val;
  }
  return acc;
}, {});

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY)),
});
const db = admin.firestore();

async function restoreDataFromApps() {
  try {
    const usersSnap = await db.collection('users').get();
    let restoreCount = 0;
    
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      
      // Get all applications for this user
      const appsSnap = await db.collection('applications')
        .where('userId', '==', userDoc.id)
        .orderBy('appliedAt', 'desc')
        .limit(1)
        .get();
        
      if (appsSnap.empty) continue;
      
      const latestApp = appsSnap.docs[0].data();
      const updates = {};
      
      const fieldsToRestore = [
        'residence', 'instaId', 'smoking', 'drinking', 
        'religion', 'drink', 'idealType', 'nonIdealType', 'avoidList'
      ];
      
      fieldsToRestore.forEach(field => {
        // If user doc is missing it, but app doc has it, restore it!
        if (latestApp[field] !== undefined && latestApp[field] !== null && latestApp[field] !== '') {
          if (!userData[field] || (Array.isArray(userData[field]) && userData[field].length === 0)) {
            updates[field] = latestApp[field];
          }
        }
      });
      
      if (Object.keys(updates).length > 0) {
        console.log(`Restoring data for ${userData.name} (${userDoc.id}):`, updates);
        await userDoc.ref.update(updates);
        restoreCount++;
      }
    }
    
    console.log(`\n✅ Completed restoring data for ${restoreCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

restoreDataFromApps();
