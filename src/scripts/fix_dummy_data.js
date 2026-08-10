const admin = require('firebase-admin');
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const MALE_JOBS = ['의사', '의사', '공인회계사', '변리사', '간호사', '세무사'];
const FEMALE_JOBS = ['한의사', '약사', '관세사', '간호사', '간호사', '약사'];
const MALE_NAMES = ['김도윤', '이시우', '박지호', '최준우', '정서준', '강민준'];
const FEMALE_NAMES = ['김서연', '이서아', '박지유', '최하은', '정지아', '강수아'];
const MALE_AGES = [33, 34, 32, 35, 30, 31];
const FEMALE_AGES = [29, 31, 28, 27, 26, 30];
const CURRENT_YEAR = 2026;

const SESSION_ID = 'h93In0JvH60iNEFIRrU7';

async function fix() {
  const appsSnap = await db.collection('applications')
    .where('sessionId', '==', SESSION_ID)
    .get();

  const batch = db.batch();
  let count = 0;

  for (const doc of appsSnap.docs) {
    const app = doc.data();
    if (!app.userId.startsWith('dummy_')) continue;

    const slotIdx = app.slotNumber - 1;
    let name, job, birthDate, phone;

    if (app.gender === 'male') {
      name = MALE_NAMES[slotIdx];
      job = MALE_JOBS[slotIdx];
      birthDate = `${CURRENT_YEAR - MALE_AGES[slotIdx] + 1}-01-01`;
      phone = `010-1111-${1000 + slotIdx}`;
    } else {
      name = FEMALE_NAMES[slotIdx];
      job = FEMALE_JOBS[slotIdx];
      birthDate = `${CURRENT_YEAR - FEMALE_AGES[slotIdx] + 1}-01-01`;
      phone = `010-2222-${2000 + slotIdx}`;
    }

    // Update User Doc
    const userRef = db.collection('users').doc(app.userId);
    batch.update(userRef, {
      name,
      job,
      birthDate,
      phone
    });

    // Update App Doc
    batch.update(doc.ref, {
      name,
      job,
      birthDate,
      phone
    });
    count++;
  }

  await batch.commit();
  console.log(`Successfully fixed ${count} dummy users and apps.`);
}

fix().catch(console.error).finally(() => process.exit(0));
