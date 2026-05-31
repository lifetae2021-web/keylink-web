import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const serviceAccount = JSON.parse(serviceAccountJson!);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

interface AvoidEntry { name?: string; birthYear?: string; workplace?: string; }

// 기존 텍스트에서 회피 목록을 파싱하는 함수
function parseAvoidText(text: string): AvoidEntry[] {
  if (!text || text.trim() === '없음' || text.trim() === '') return [];

  // 쉼표나 줄바꿈으로 구분된 항목들을 분리
  const parts = text.split(/[,，\n]+/).map(p => p.trim()).filter(Boolean);

  return parts.map(part => {
    const entry: AvoidEntry = {};

    // 숫자(00~09 또는 두 자리 년도)로 시작하면 년생이 앞에 있는 경우
    // 예: "97이규호", "91년 김민찬"
    const matchFrontYear = part.match(/^(\d{2})(?:년(?:생)?)?\s*(.+)/);
    if (matchFrontYear) {
      entry.birthYear = matchFrontYear[1];
      const rest = matchFrontYear[2].trim();
      // 나머지 부분에서 직장/거주지 추출
      const parenMatch = rest.match(/^([^(（]+)[（(]([^)）]+)[)）]\s*(?:[,，]\s*(.+))?$/);
      if (parenMatch) {
        entry.name = parenMatch[1].trim();
        entry.workplace = [parenMatch[2], parenMatch[3]].filter(Boolean).join(', ');
      } else {
        entry.name = rest;
      }
      return entry;
    }

    // "이름/직장" 형태: "김재영/울산거주/1998년생"
    if (part.includes('/')) {
      const slashParts = part.split('/').map(s => s.trim());
      entry.name = slashParts[0];
      const yearPart = slashParts.find(s => s.match(/\d{4}년생/));
      if (yearPart) {
        const m = yearPart.match(/(\d{2,4})년생/);
        if (m) entry.birthYear = m[1].slice(-2);
      }
      const locationPart = slashParts.find(s => s.includes('거주') || s.includes('지역') || s.match(/[가-힣]{2,}시|[가-힣]{2,}구/));
      if (locationPart) entry.workplace = locationPart.replace('거주', '').trim();
      return entry;
    }

    // "이름(직장명, 거주지)" 형태
    const parenMatch = part.match(/^([^(（\s]+(?:\s[^(（]+)*?)\s*[（(]([^)）]+)[)）]/);
    if (parenMatch) {
      entry.name = parenMatch[1].trim();
      entry.workplace = parenMatch[2].trim();
      return entry;
    }

    // 단순 "같은 직장", "초등교사" 같은 경우
    if (['같은 회사', '같은회사', '같은 직장', '팬오션 회사'].some(kw => part.includes(kw)) || !part.match(/[가-힣]{2,}/)) {
      entry.workplace = part;
      return entry;
    }

    // 그냥 이름처럼 보이는 경우
    entry.name = part;
    return entry;
  }).filter(e => e.name || e.birthYear || e.workplace);
}

// 수동 매핑 (자동 파싱이 어려운 경우)
const manualMappings: Record<string, AvoidEntry[]> = {
  '1M1UW8OBJZY4iin4b5MHDtBu78a2': [{ name: '심종화' }],  // 김수비: 심종화
  'EX0hrdp7avZkkJBJNZzHpURbIpn2': [{ name: '김민찬', birthYear: '91' }, { name: '김범석', birthYear: '88' }],  // 조문주
  'IZsOU9nsX6Z9jtq19Sl2S6EyAG23': [],  // 태영훈: "123" - 무의미한 데이터
  'Pp2Uq1gbOlX9P5b0HyOrYxp0Jdh1': [  // 류채원
    { name: '이규호', birthYear: '97' },
    { name: '이대훈', birthYear: '97', workplace: '울산' },
    { name: '전승훈', birthYear: '96', workplace: '김해' },
    { name: '전동현', birthYear: '98', workplace: '울산' },
    { name: '김민규', birthYear: '97', workplace: '공기업' },
    { name: '이재형', birthYear: '00', workplace: '김해' },
    { name: '', birthYear: '96', workplace: '해운대 거주 포항 근무' },
  ],
  'kakao_4873471532': [  // 송은비
    { workplace: '팬오션 회사' },
    { name: '배민수', birthYear: '92' },
    { name: '김민석', birthYear: '92' },
    { name: '이윤재', birthYear: '93' },
  ],
  'kakao_4874645932': [{ workplace: '같은 직장' }],  // 이지은
  'kakao_4875396308': [{ workplace: '같은 직장' }, { name: '김기훈', birthYear: '93' }],  // 이윤주
  'kakao_4876081262': [  // 강새별
    { name: '백승훈', birthYear: '95' },
    { name: '정민규', birthYear: '94' },
    { name: '김정환', birthYear: '95' },
    { name: '정지우', birthYear: '96' },
    { name: '이우형', birthYear: '00' },
    { name: '김진수', birthYear: '98' },
    { name: '김동주', birthYear: '01' },
    { name: '김동하', birthYear: '96' },
    { name: '박강현', birthYear: '96' },
  ],
  'kakao_4884226816': [{ name: '공승주' }],  // 윤지원
  'kakao_4890652347': [{ workplace: '같은 회사' }],  // 전나영
  'kakao_4904919875': [{ name: '서다혜', birthYear: '97' }, { name: '박지해', birthYear: '94' }],  // 김지민
  'kakao_4913295231': [],  // 이동건: "없음"
  'kakao_4913612868': [{ workplace: '초등교사' }],  // 안정진
  'kakao_4920357166': [{ name: '김재영', birthYear: '98', workplace: '울산거주' }],  // 이수진
  'zKz29KDaoMeKhSa1PHJrnz6w1DP2': [  // 유한나래
    { name: '조명근' },
    { name: '이상현' },
    { name: '이준석' },
    { name: '백지성' },
    { name: '김대훈' },
  ],
};

async function run() {
  const batch = db.batch();
  let count = 0;

  for (const [userId, avoidList] of Object.entries(manualMappings)) {
    const userRef = db.collection('users').doc(userId);
    const snap = await userRef.get();
    if (!snap.exists) {
      console.log(`User ${userId} not found, skipping`);
      continue;
    }
    const data = snap.data()!;
    console.log(`Migrating ${data.name} (${userId}): ${avoidList.length} entries`);
    batch.update(userRef, { avoidList });
    count++;
  }

  await batch.commit();
  console.log(`\nMigration complete! Updated ${count} users.`);
}

run().catch(console.error);
