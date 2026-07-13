const admin = require('firebase-admin');

// Ensure we don't initialize multiple times if script is run repeatedly in same process
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'keylink-web-2caf2'
  });
}

const db = admin.firestore();

async function checkRecentApplications() {
  try {
    const appsRef = db.collection('applications');
    const snapshot = await appsRef.orderBy('appliedAt', 'desc').limit(5).get();
    
    if (snapshot.empty) {
      console.log('No applications found.');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n--- Application ID: ${doc.id} ---`);
      console.log(`User ID: ${data.userId}`);
      console.log(`Name: ${data.name}`);
      console.log(`Session ID: ${data.sessionId}`);
      console.log(`Status: ${data.status}`);
      console.log(`Applied At: ${data.appliedAt ? data.appliedAt.toDate().toISOString() : 'N/A'}`);
      console.log(`Photos Length: ${data.photos ? data.photos.length : 0}`);
      console.log(`Photos Type: ${data.photos && data.photos.length > 0 ? (data.photos[0].startsWith('http') ? 'URL' : (data.photos[0].startsWith('data:image') ? 'Base64' : 'Unknown')) : 'N/A'}`);
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
  }
}

checkRecentApplications();
