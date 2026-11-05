// 키링 월드 동물 호감 — 웹 화면과 서버(/api/plaza/pets, 상점 밥주기)가 같이 쓰는 규칙
// 호감 0~100: 30 따라오기 · 60 안기 · 100 이름 짓고 반려동물로 데려가기(입장할 때마다 졸졸 따라옴, 남들에게도 보임)
export const PETS = [
  { id: 'bori', name: '보리', kind: 'dog' }, { id: 'cheese', name: '치즈', kind: 'cat' }, { id: 'blocknyang', name: '블록냥', kind: 'cat' },
  { id: 'donggeul', name: '동글이', kind: 'cat' }, { id: 'dotnyang', name: '도트냥', kind: 'cat' }, { id: 'noeul', name: '노을이', kind: 'cat' },
  { id: 'somsatang', name: '솜사탕', kind: 'dog' }, { id: 'goldy', name: '골디', kind: 'dog' },
];
export const PET_IDS = PETS.map((p) => p.id);
export const AFF = { follow: 30, hold: 60, adopt: 100, max: 100 };
export const AFF_PET = 3;            // 쓰다듬기 1번
export const PET_DAILY = 10;         // 동물마다 하루 쓰다듬기 인정 횟수
export const PET_COOLDOWN_MS = 4000;
export const AFF_FEED = 20;          // 밥주기(포인트) 1번
export const PET_NAME_MAX = 8;
export const ADOPT_MAX = 3;          // 반려동물 최대 마리 수
export const petKindLabel = (kind, adopted) => (kind === 'dog' ? (adopted ? '반려견' : '강아지') : (adopted ? '반려묘' : '고양이'));

// 호감이 떨어지는 규칙: 마지막으로 돌봐 준(쓰다듬기·밥) 뒤 하루가 지나면 하루에 5씩 줄어든다(0 아래로는 안 내려감).
// 반려동물도 똑같이 줄고, 30 아래면 삐져서 따라오지 않는다(이름과 반려동물 자격은 그대로).
export const AFF_DECAY_GRACE_MS = 24 * 60 * 60 * 1000;
export const AFF_DECAY_PER_DAY = 5;
export function currentAff(stored, at, now = Date.now()) {
  const n = Number(stored) || 0, t = Number(at) || 0;
  if (!n || !t) return n;
  const days = Math.floor((now - t - AFF_DECAY_GRACE_MS) / (24 * 60 * 60 * 1000)) + 1;
  return days > 0 ? Math.max(0, n - days * AFF_DECAY_PER_DAY) : n;
}
// 많이 떨어진 동물은 쓰다듬기로 더 빨리 회복(최대 +6)
export const petGain = (aff) => (aff < 30 ? 6 : aff < 60 ? 4 : AFF_PET);
