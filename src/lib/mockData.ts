import { KeylinkEvent } from '@/types';

export const mockEvents: KeylinkEvent[] = [
  {
    id: 'session-120',
    title: '부산 로테이션 소개팅',
    region: 'busan',
    venue: '서면역 인근',
    venueAddress: '부산광역시 부산진구 부전동 (상세 장소는 개별 안내)',
    date: new Date('2026-04-26T14:00:00'),
    time: '14:00',
    maxMale: 8,
    maxFemale: 8,
    currentMale: 6,
    currentFemale: 7,
    price: 29000,
    originalPrice: 39000,
    currentPrice: 29000,
    status: 'open',
    description: '부산 서면역 인근 프리미엄 공간에서 진행되는 소규모 로테이션 소개팅입니다.',
    rankingOpen: false,
    matchingOpen: false,
    episode: 120,
    targetMaleAge: '94~98',
    targetFemaleAge: '94~98',
    createdAt: new Date(),
  },
  {
    id: 'session-121',
    title: '부산 로테이션 소개팅',
    region: 'busan',
    venue: '서면역 인근',
    venueAddress: '부산광역시 부산진구 부전동 (상세 장소는 개별 안내)',
    date: new Date('2026-05-03T14:00:00'),
    time: '14:00',
    maxMale: 8,
    maxFemale: 8,
    currentMale: 2,
    currentFemale: 3,
    price: 29000,
    originalPrice: 39000,
    currentPrice: 29000,
    status: 'open',
    description: '부산 서면역 인근 프리미엄 공간에서 진행되는 소규모 로테이션 소개팅입니다.',
    rankingOpen: false,
    matchingOpen: false,
    episode: 121,
    targetMaleAge: '90~96',
    targetFemaleAge: '90~96',
    createdAt: new Date(),
  },
];

export const mockReviews = [
  {
    id: '1',
    couple: '김*수 ❤ 박*연',
    text: '처음엔 긴장했는데 진행이 너무 자연스러워서 금방 편안해졌어요. 덕분에 정말 좋은 분을 만났습니다. 2025년 6월에 키링크에서 만나서 이제 곧 1년이 돼요!',
    episode: '87기',
    region: '부산',
  },
  {
    id: '2',
    couple: '이*진 ❤ 최*호',
    text: '소규모라서 더 집중해서 대화할 수 있었어요. 8명이라 모든 분과 충분히 이야기를 나눌 수 있었고, 그 중에서 지금의 남자친구를 만났습니다 💛',
    episode: '101기',
    region: '부산',
  },
  {
    id: '3',
    couple: '오*현 ❤ 윤*서',
    text: '웹사이트에서 바로 예약하고 당일에 QR로 매칭 순위 입력까지. 디지털 시스템이 너무 편리해서 놀랐어요. 결과도 바로 확인할 수 있어서 두근두근했습니다 🥰',
    episode: '118기',
    region: '부산',
  },
];

export const mockLineup = [
  // 남성 참가자
  { id: 'm1', gender: 'male', year: '95', occupation: '개인사업자', mbti: 'ENFJ', height: '178', keywords: ['운동매니아', '자기관리', '다정다감'], status: 'confirmed' },
  { id: 'm2', gender: 'male', year: '95', occupation: '공무원', mbti: 'ISTJ', height: '174', keywords: ['안정적인', '계획형', '듬직한'], status: 'confirmed' },
  { id: 'm3', gender: 'male', year: '94', occupation: '회사원 (IT)', mbti: 'INTP', height: '181', keywords: ['지성적인', '여유로운', '유머러스'], status: 'confirmed' },
  { id: 'm4', gender: 'male', year: '91', occupation: '대기업 사무직', mbti: 'ENTJ', height: '177', keywords: ['리더십', '열정적인', '자상한'], status: 'confirmed' },
  { id: 'm5', gender: 'male', year: '91', occupation: '경찰공무원', mbti: 'ESTP', height: '183', keywords: ['활동적인', '솔직한', '에너지'], status: 'confirmed' },
  { id: 'm6', gender: 'male', year: '95', occupation: '공공기관', mbti: 'INFJ', height: '175', keywords: ['경청하는', '섬세한', '차분한'], status: 'confirmed' },
  { id: 'm7', gender: 'male', year: '92', occupation: '중견기업 연구원', mbti: 'INTJ', height: '179', keywords: ['분석적인', '목표지향', '성실한'], status: 'confirmed' },
  { id: 'm8', gender: 'male', year: '', occupation: '모집중', mbti: '', height: '', keywords: [], status: 'recruiting' },
  
  // 여성 참가자
  { id: 'f1', gender: 'female', year: '94', occupation: '개인사업자', mbti: 'ENFP', height: '162', keywords: ['밝은에너지', '사교적인', '공감왕'], status: 'confirmed' },
  { id: 'f2', gender: 'female', year: '93', occupation: '전문직 (의료)', mbti: 'ISFJ', height: '158', keywords: ['배려심', '꼼꼼한', '따뜻한'], status: 'confirmed' },
  { id: 'f3', gender: 'female', year: '94', occupation: '서비스업 (코디)', mbti: 'ESFJ', height: '165', keywords: ['상냥한', '패션감각', '센스쟁이'], status: 'confirmed' },
  { id: 'f4', gender: 'female', year: '91', occupation: '중소기업 사무직', mbti: 'ISTP', height: '160', keywords: ['쿨한성격', '취미부자', '차분한'], status: 'confirmed' },
  { id: 'f5', gender: 'female', year: '95', occupation: '회사원 (마케팅)', mbti: 'ENFJ', height: '163', keywords: ['커뮤니케이션', '자기개발', '긍정적'], status: 'confirmed' },
  { id: 'f6', gender: 'female', year: '97', occupation: '프리랜서 디자이너', mbti: 'INFP', height: '167', keywords: ['예술적감성', '몽글몽글', '진실된'], status: 'confirmed' },
  { id: 'f7', gender: 'female', year: '96', occupation: '금융권 사무직', mbti: 'ESTJ', height: '161', keywords: ['똑부러지는', '성실함', '웃음꽃'], status: 'confirmed' },
  { id: 'f8', gender: 'female', year: '94', occupation: '보건인력', mbti: 'ISFP', height: '159', keywords: ['감각적인', '경청', '예술가기질'], status: 'confirmed' },
];

export const mockMatchingResults = [
  {
    id: 'res-119',
    episode: 119,
    date: '2026-04-19',
    totalParticipants: 16,
    coupleCount: 6,
    matchingRate: 75,
    atmosphere: '벚꽃이 만개한 주말, 서면의 따뜻한 분위기 속에서 설레는 대화가 이어졌습니다. 역대급 비주얼 기수라는 평이 많았던 만큼 매칭률도 굉장히 높았습니다.',
    labels: ['역대급 매칭률', '하트 100개 돌파']
  },
  {
    id: 'res-118',
    episode: 118,
    date: '2026-04-12',
    totalParticipants: 16,
    coupleCount: 5,
    matchingRate: 62.5,
    atmosphere: '비가 살짝 오는 일요일이었지만, 실내 공간의 아늑함 덕분에 더 깊은 대화가 가능했습니다. 차분하고 지적인 매력의 참가자분들이 많으셨습니다.',
    labels: ['지적인 기수']
  },
  {
    id: 'res-117',
    episode: 117,
    date: '2026-04-05',
    totalParticipants: 14,
    coupleCount: 4,
    matchingRate: 57,
    atmosphere: '활기차고 에너제틱한 분위기의 기수였습니다. 대화 시간이 부족할 정도로 웃음소리가 끊이지 않았던 즐거운 시간이었습니다.',
    labels: ['텐션 업']
  },
  {
    id: 'res-116',
    episode: 116,
    date: '2026-03-29',
    totalParticipants: 16,
    coupleCount: 7,
    matchingRate: 87.5,
    atmosphere: '첫 만남부터 서로의 취향이 잘 맞아떨어진 기수였습니다. 무려 7쌍이나 탄생하며 키링크 역사를 새로 쓴 기적이었습니다.',
    labels: ['기적의 매칭']
  }
];
