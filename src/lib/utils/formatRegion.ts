export function formatRegion(residence: string): string {
  if (!residence) return '미입력';

  const normalized = residence.trim();
  
  // 1. 사전 정의된 주요 키워드 매핑 (부산 구/동, 창원 구/동 등)
  const busanKeywords = ['부산', '해운대', '수영구', '진구', '서면', '동래', '광안', '남구', '사하', '연제', '북구', '사상', '기장', '영도', '동구', '서구', '중구', '금정'];
  const changwonKeywords = ['창원', '마산', '진해', '의창', '성산', '합포', '회원'];
  
  // 2. 주요 시/도 목록 (그대로 사용할 도시명)
  const majorCities = ['김해', '양산', '울산', '진주', '거제', '밀양', '사천', '통영', '서울', '대구', '대전', '인천', '광주', '제주', '포항', '경주', '구미'];

  // 매핑 로직 1: 부산 관련 지역인지 확인
  if (busanKeywords.some(keyword => normalized.includes(keyword))) {
    return '부산';
  }
  
  // 매핑 로직 2: 창원 관련 지역인지 확인
  if (changwonKeywords.some(keyword => normalized.includes(keyword))) {
    return '창원';
  }

  // 매핑 로직 3: 주요 도시명 확인 (예: 김해시 -> 김해)
  for (const city of majorCities) {
    if (normalized.includes(city)) {
      return city;
    }
  }

  // 매핑 로직 4: 알 수 없는 지역일 경우 (안전 장치 / Fallback)
  // - 띄어쓰기 기준으로 첫 번째 단어만 추출 (예: '포항시 남구' -> '포항시')
  let firstWord = normalized.split(/\s+/)[0];
  
  // - 끝이 '시', '군', '구' 등으로 끝나면 제거 (단, 2글자 이상일 때만)
  if (firstWord.length > 2 && (firstWord.endsWith('시') || firstWord.endsWith('군') || firstWord.endsWith('구'))) {
    firstWord = firstWord.slice(0, -1);
  }

  return firstWord;
}
