// 닉네임 비속어 필터 — 광장 화면 · Next API(/api/plaza/join) · Cloudflare 실시간 서버가 이 파일 하나를 같이 쓴다.
// 띄어쓰기·숫자·기호를 섞어 우회하는 것(예: "시 1 발", "s.e.x")도 잡도록 정규화한 뒤 포함 여부로 검사한다.
// 목록을 고치면 세 곳 모두에 반영된다(실시간 서버는 재배포 필요).

const WORDS = [
  // 욕설
  '시발', '씨발', '씨빨', '시빨', '쓰발', '씹', '씨팔', '시팔', '개새', '개색', '개쌔', '개세끼', '새끼', '쌔끼', '색히',
  '병신', '븅신', '빙신', '좆', '존나', '졸라', '지랄', '염병', '엠창', '니미', '니애미', '느금', '애미', '애비',
  '미친년', '미친놈', '닥쳐', '꺼져', '썅', '엿먹', '호로', '후레', '등신', '찐따', '개년', '개놈', '걸레',
  // 자모 줄임말
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅄ', 'ㅈㄴ', 'ㅈㄹ', 'ㅆㄹㄱ', 'ㅁㅊ', 'ㄴㄱㅁ', 'ㄲㅈ',
  // 성적인 표현
  '섹스', '쎅스', '섹파', '야동', '보지', '자지', '잦이', '꼴려', '꼴림', '딸딸', '자위', '오랄', '펠라', '빨통',
  '유두', '강간', '성폭', '몸캠', '조건만남', '원나잇', '원나이트', '변태', '페티쉬', '노콘', '질싸', '야스',
  // 비하·혐오
  '한남충', '김치녀', '맘충', '틀딱', '급식충', '흑형',
  // 영어
  'fuck', 'shit', 'bitch', 'sex', 'porn', 'dick', 'pussy', 'cock', 'asshole', 'slut', 'whore', 'cunt', 'nigger',
];

// 한글(완성형·자모)과 영문만 남기고 소문자로 — 띄어쓰기·숫자·기호 끼워넣기 우회 차단
export function normalizeNick(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
}

const NORMALIZED = WORDS.map(normalizeNick).filter(Boolean);

// 자음·모음만으로 된 닉네임(예: ㅇㄹㅎ, ㅋㅋㅋ) — 숫자·기호를 빼고 남은 글자가 전부 자모면 true
export function isJamoOnly(s) {
  const letters = normalizeNick(s);
  return letters.length > 0 && /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(letters);
}

// 닉네임 문제 종류: 'jamo' | 'bad' | null
export function nickProblem(s) {
  if (isJamoOnly(s)) return 'jamo';
  if (hasBadWord(s)) return 'bad';
  return null;
}

// 운영자처럼 보이는 닉네임 — 관리자(서버가 확인한 계정)만 쓸 수 있다
const RESERVED = ['관리자', '운영자', '운영진', '운영팀', '키링크', 'keylink', 'admin', '어드민', '스태프', 'staff'].map(normalizeNick);
export function isReservedNick(s) {
  const n = normalizeNick(s);
  return !!n && RESERVED.some((w) => n.includes(w));
}

export function hasBadWord(s) {
  const n = normalizeNick(s);
  if (!n) return false;
  return NORMALIZED.some((w) => n.includes(w));
}
