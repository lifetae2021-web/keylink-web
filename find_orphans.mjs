import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envConfig = fs.readFileSync('.env.local', 'utf-8');
envConfig.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    process.env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!global.adminApp) {
  global.adminApp = initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function findOrphanedApps() {
  const appsSnap = await db.collection('applications').get();
  const sessionsSnap = await db.collection('sessions').get();
  
  const sessionIds = new Set(sessionsSnap.docs.map(doc => doc.id));
  
  const orphanedApps = appsSnap.docs.filter(doc => {
    const data = doc.data();
    return !sessionIds.has(data.sessionId);
  });
  
  console.log(`Found ${orphanedApps.length} orphaned apps.`);
  
  const appsBySession = {};
  for (const app of orphanedApps) {
    const data = app.data();
    if (!appsBySession[data.sessionId]) {
      appsBySession[data.sessionId] = [];
    }
    appsBySession[data.sessionId].push({ id: app.id, name: data.name, status: data.status, userId: data.userId });
  }
  
  console.log(JSON.stringify(appsBySession, null, 2));
}

findOrphanedApps();
