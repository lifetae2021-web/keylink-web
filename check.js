import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'keylink-web-2caf2' });
}

const db = admin.firestore();

async function main() {
  const usersSnap = await db.collection('users').orderBy('createdAt', 'desc').limit(5).get();
  console.log("=== RECENT USERS ===");
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`User: ${data.name} (${doc.id}) - Created: ${data.createdAt?.toDate()}`);
  });

  const appsSnap = await db.collection('applications').orderBy('appliedAt', 'desc').limit(5).get();
  console.log("\n=== RECENT APPLICATIONS ===");
  appsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`App: ${data.name} (${doc.id}) - User: ${data.userId} - Session: ${data.sessionId} - Status: ${data.status} - Applied: ${data.appliedAt?.toDate()}`);
  });
}

main().catch(console.error);
