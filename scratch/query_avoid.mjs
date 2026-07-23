import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "keylink-web-2caf2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  try {
    const sessionsRef = collection(db, 'sessions');
    let sessionSnap = await getDocs(query(sessionsRef, where('episodeNumber', '==', 134)));
    if (sessionSnap.empty) {
      sessionSnap = await getDocs(query(sessionsRef, where('episodeNumber', '==', '134')));
    }
    
    if (sessionSnap.empty) {
      console.log('134기 세션을 찾을 수 없습니다.');
      return;
    }

    const sessionId = sessionSnap.docs[0].id;
    console.log(`134기 세션 ID: ${sessionId}`);

    const appsSnap = await getDocs(query(
      collection(db, 'applications'),
      where('sessionId', '==', sessionId),
      where('gender', '==', 'female')
    ));

    console.log(`134기 여성 신청자 수: ${appsSnap.size}`);

    const avoiders = [];

    for (const docSnap of appsSnap.docs) {
      const data = docSnap.data();
      const userId = data.userId;
      
      let appAvoidList = data.avoidList || [];
      appAvoidList = appAvoidList.filter(e => 
        (e.name && e.name.trim()) || (e.birthYear && e.birthYear.trim()) || (e.workplace && e.workplace.trim())
      );
      const appAvoidAcquaintance = data.avoidAcquaintance ? data.avoidAcquaintance.trim() : '';

      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      let userAvoidList = userData.avoidList || [];
      userAvoidList = userAvoidList.filter(e => 
        (e.name && e.name.trim()) || (e.birthYear && e.birthYear.trim()) || (e.workplace && e.workplace.trim())
      );
      const userAvoidAcquaintance = userData.avoidAcquaintance ? userData.avoidAcquaintance.trim() : '';

      const hasAppAvoid = appAvoidList.length > 0 || appAvoidAcquaintance;
      const hasUserAvoid = userAvoidList.length > 0 || userAvoidAcquaintance;

      if (hasAppAvoid || hasUserAvoid) {
        avoiders.push({
          name: data.name,
          phone: data.phone,
          status: data.status,
          appAvoidList,
          appAvoidAcquaintance,
          userAvoidList,
          userAvoidAcquaintance
        });
      }
    }

    console.log('\n--- 지인회피 작성자 목록 ---');
    if (avoiders.length === 0) {
      console.log('지인회피를 작성한 여성 신청자가 없습니다.');
    } else {
      avoiders.forEach((a, i) => {
        console.log(`\n${i + 1}. ${a.name} (${a.phone}, 상태: ${a.status})`);
        
        const formatList = (list) => list.map(e => {
            const parts = [];
            if (e.name) parts.push(`이름: ${e.name}`);
            if (e.birthYear) parts.push(`년생: ${e.birthYear}`);
            if (e.workplace) parts.push(`직장/거주지: ${e.workplace}`);
            return parts.join(' / ');
        }).join('\n    ');

        if (a.appAvoidList.length > 0) {
          console.log(`  - [신청서] avoidList:\n    ${formatList(a.appAvoidList)}`);
        }
        if (a.appAvoidAcquaintance) {
          console.log(`  - [신청서] avoidAcquaintance: ${a.appAvoidAcquaintance}`);
        }
        if (a.userAvoidList.length > 0) {
          console.log(`  - [유저정보] avoidList:\n    ${formatList(a.userAvoidList)}`);
        }
        if (a.userAvoidAcquaintance) {
          console.log(`  - [유저정보] avoidAcquaintance: ${a.userAvoidAcquaintance}`);
        }
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
