const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkAndShift() {
  const snapshot = await db.collection('sessions').get();

  const sessionsToShift = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.region === 'busan' && data.episodeNumber >= 136) {
      sessionsToShift.push({ id: doc.id, ...data });
    }
  });

  console.log(`Found ${sessionsToShift.length} sessions to shift.`);
  
  for (const session of sessionsToShift) {
    console.log(`Session: ${session.title}, Episode: ${session.episodeNumber}`);
    
    // Shift episodeNumber and update title
    const newEpisode = session.episodeNumber - 1;
    let newTitle = session.title;
    if (newTitle && newTitle.includes(session.episodeNumber.toString())) {
      newTitle = newTitle.replace(session.episodeNumber.toString(), newEpisode.toString());
    }

    await db.collection('sessions').doc(session.id).update({
      episodeNumber: newEpisode,
      title: newTitle
    });
    console.log(`Updated ${session.id} -> Episode: ${newEpisode}, Title: ${newTitle}`);
  }
}

checkAndShift().catch(console.error).finally(() => process.exit(0));
