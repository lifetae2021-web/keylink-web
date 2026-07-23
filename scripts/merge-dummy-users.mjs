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

const serviceAccountJson = envVars.FIREBASE_SERVICE_ACCOUNT_KEY;
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
});
const db = admin.firestore();

async function mergeDuplicateUsers() {
  try {
    const snap = await db.collection('users').get();
    const phoneMap = {};
    
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.phone) {
        if (!phoneMap[data.phone]) phoneMap[data.phone] = [];
        phoneMap[data.phone].push({ id: d.id, ...data });
      }
    });

    for (const [phone, users] of Object.entries(phoneMap)) {
      if (users.length > 1) {
        const registered = users.filter(u => u.isRegistered);
        const unregistered = users.filter(u => !u.isRegistered);
        
        if (registered.length > 0 && unregistered.length > 0) {
          console.log(`\nFound duplicate for ${phone} (${users[0].name})`);
          const regUser = registered[0];
          const unregUser = unregistered[0];
          
          let updates = {};
          // Merge missing fields from unregistered to registered
          ['employmentProof', 'photos', 'job', 'workplace'].forEach(field => {
            if (unregUser[field] && (!regUser[field] || (Array.isArray(regUser[field]) && regUser[field].length === 0))) {
              updates[field] = unregUser[field];
              console.log(`  - Will merge ${field}:`, unregUser[field]);
            }
          });
          
          if (Object.keys(updates).length > 0) {
             await db.collection('users').doc(regUser.id).update(updates);
             console.log(`  ✅ Merged into ${regUser.id}`);
          } else {
             console.log(`  - No missing fields to merge`);
          }
          
          // Delete unregistered user doc
          await db.collection('users').doc(unregUser.id).delete();
          console.log(`  ✅ Deleted unregistered dummy user: ${unregUser.id}`);
        }
      }
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
mergeDuplicateUsers();
