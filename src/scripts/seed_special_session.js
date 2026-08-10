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
const CURRENT_YEAR = new Date().getFullYear();

const SESSION_ID = 'h93In0JvH60iNEFIRrU7';

async function seed() {
  const batch = db.batch();
  
  const maleUids = [];
  const femaleUids = [];

  // Create Males
  for (let i = 0; i < 6; i++) {
    const uid = `dummy_m_${i + 1}_${Date.now()}`;
    maleUids.push(uid);
    
    // User doc
    const userRef = db.collection('users').doc(uid);
    batch.set(userRef, {
      uid,
      name: MALE_NAMES[i],
      gender: 'male',
      birthDate: `${CURRENT_YEAR - MALE_AGES[i] + 1}-01-01`,
      phone: `010-1111-${1000 + i}`,
      job: MALE_JOBS[i],
      workplace: '부산 해운대구',
      residence: '부산 수영구',
      idealType: '대화가 잘 통하고 밝은 분',
      isGuest: false,
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Application doc
    const appRef = db.collection('applications').doc(`${SESSION_ID}_${uid}`);
    batch.set(appRef, {
      id: appRef.id,
      sessionId: SESSION_ID,
      userId: uid,
      name: MALE_NAMES[i],
      phone: `010-1111-${1000 + i}`,
      gender: 'male',
      status: 'confirmed',
      attended: true,
      slotNumber: i + 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      idealType: '대화가 잘 통하고 밝은 분',
      job: MALE_JOBS[i],
      birthDate: `${CURRENT_YEAR - MALE_AGES[i] + 1}-01-01`
    }, { merge: true });
  }

  // Create Females
  for (let i = 0; i < 6; i++) {
    const uid = femaleUidsGlobal[i]; // Use previously generated UIDs
    femaleUids.push(uid);
    
    // User doc
    const userRef = db.collection('users').doc(uid);
    batch.set(userRef, {
      uid,
      name: FEMALE_NAMES[i],
      gender: 'female',
      birthDate: `${CURRENT_YEAR - FEMALE_AGES[i] + 1}-01-01`,
      phone: `010-2222-${2000 + i}`,
      job: FEMALE_JOBS[i],
      workplace: '부산 서면',
      residence: '부산 남구',
      idealType: '다정하고 배울 점이 많은 분',
      isGuest: false,
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Application doc
    const appRef = db.collection('applications').doc(`${SESSION_ID}_${uid}`);
    batch.set(appRef, {
      id: appRef.id,
      sessionId: SESSION_ID,
      userId: uid,
      name: FEMALE_NAMES[i],
      phone: `010-2222-${2000 + i}`,
      gender: 'female',
      status: 'confirmed',
      attended: true,
      slotNumber: i + 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      idealType: '다정하고 배울 점이 많은 분',
      job: FEMALE_JOBS[i],
      birthDate: `${CURRENT_YEAR - FEMALE_AGES[i] + 1}-01-01`
    }, { merge: true });
  }

  // Create perfect matching votes
  // 1호 <-> 1호, 2호 <-> 2호 ...
  for (let i = 0; i < 6; i++) {
    // Male votes for female
    const mVoteRef = db.collection('votes').doc(`${SESSION_ID}_${maleUids[i]}`);
    batch.set(mVoteRef, {
      sessionId: SESSION_ID,
      userId: maleUids[i],
      choices: [{ targetUserId: femaleUids[i], priority: 1 }],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Female votes for male
    const fVoteRef = db.collection('votes').doc(`${SESSION_ID}_${femaleUids[i]}`);
    batch.set(fVoteRef, {
      sessionId: SESSION_ID,
      userId: femaleUids[i],
      choices: [{ targetUserId: maleUids[i], priority: 1 }],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Update Session
  const sessionRef = db.collection('sessions').doc(SESSION_ID);
  batch.update(sessionRef, {
    maxMale: 6,
    maxFemale: 6,
    currentMale: 6,
    currentFemale: 6,
    feedConfig: {
      selectedMen: maleUids,
      selectedWomen: femaleUids,
      customTexts: {}
    }
  });

  await batch.commit();
  console.log('Successfully seeded 12 users, applications, and votes for perfect match.');
}

seed().catch(console.error).finally(() => process.exit(0));
