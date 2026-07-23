import { adminDb } from '../src/lib/firebaseAdmin';

async function findMissingHeightWeightUsers() {
  try {
    const usersSnap = await adminDb.collection('users').where('status', '==', 'verified').get();
    
    console.log(`Total verified users: ${usersSnap.size}`);
    
    const missingUsers: any[] = [];
    
    usersSnap.forEach(doc => {
      const data = doc.data();
      const h = data.height;
      const w = data.weight;
      
      const hasHeight = h !== undefined && h !== null && h !== '';
      const hasWeight = w !== undefined && w !== null && w !== '';
      
      if (!hasHeight || !hasWeight) {
        missingUsers.push({
          uid: doc.id,
          name: data.name || '이름없음',
          phone: data.phone || '번호없음',
          gender: data.gender || '성별없음',
          height: h === undefined ? 'undefined' : h === null ? 'null' : h === '' ? 'empty string' : h,
          weight: w === undefined ? 'undefined' : w === null ? 'null' : w === '' ? 'empty string' : w
        });
      }
    });
    
    console.log(`\n=== 승인된 회원 중 키/몸무게 누락 회원 (${missingUsers.length}명) ===`);
    missingUsers.forEach(u => {
      console.log(`- 이름: ${u.name} | 성별: ${u.gender} | 연락처: ${u.phone} | 키: ${u.height} | 몸무게: ${u.weight} | UID: ${u.uid}`);
    });
    
  } catch (err) {
    console.error('Error fetching users:', err);
  }
}

findMissingHeightWeightUsers();
