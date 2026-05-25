const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkApps() {
  // Get active sessions
  const sessionsSnap = await db.collection('sessions').get();
  const sessions = {};
  sessionsSnap.forEach(doc => {
    sessions[doc.id] = doc.data();
  });

  const targetSessions = Object.entries(sessions).filter(([id, data]) => 
    (data.region === 'busan' && (data.episodeNumber === 128 || data.episodeNumber === 129)) ||
    (data.region === 'changwon' && data.episodeNumber === 1)
  );

  const targetSessionIds = targetSessions.map(([id]) => id);
  console.log('Target Sessions:', targetSessions.map(([id, data]) => `${data.region} ${data.episodeNumber}기 (${id})`));

  // Get applications for these sessions
  const appsSnap = await db.collection('applications')
    .where('sessionId', 'in', targetSessionIds)
    .get();
  
  let stats = {
    total: 0,
    byStatus: {},
    dummies: 0,
    real: 0,
    realPending: 0
  };

  appsSnap.forEach(doc => {
    const data = doc.data();
    stats.total++;
    stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
    
    const isDummy = doc.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true;
    if (isDummy) {
      stats.dummies++;
    } else {
      stats.real++;
      if (['applied', 'selected'].includes(data.status)) {
        stats.realPending++;
      }
    }
  });

  console.log('\n--- Applications Stats ---');
  console.log('Total applications for these 3 sessions:', stats.total);
  console.log('Status breakdown:', stats.byStatus);
  console.log('Dummies:', stats.dummies);
  console.log('Real members:', stats.real);
  console.log('Real pending (badge count):', stats.realPending);
}

checkApps().catch(console.error);
