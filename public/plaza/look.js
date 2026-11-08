// 키링 월드 캐릭터 정보(look v2) — 웹·가입 API·워커가 같이 쓰는 규칙. 설계: plaza-blender/avatar_spec.md
// 허용된 값만 남기고 나머지는 버린다(다른 사람에게 그대로 전달되므로 외모 정보 외에는 절대 넣지 않는다).

import { PET_IDS, PET_NAME_MAX } from './pets.js';
import { hasBadWord, isReservedNick } from './badwords.js';

export const LOOK = {
  style: ['block', 'chibi'],   // block: 블록 캐릭터(기본, 블록 맵과 어울림) · chibi: 귀여운 둥근 캐릭터
  gender: ['male', 'female'],
  hair: ['short', 'dandy', 'twoblock', 'spiky', 'bob', 'long', 'ponytail', 'bun'],
  top: ['tee', 'long', 'hoodie', 'shirt', 'dress'],
  bottom: ['pants', 'shorts', 'skirt'],
  shoes: ['sneakers', 'boots'],
  acc: ['glasses', 'cap', 'beanie', 'earrings', 'crossbag', 'goldkeyring', 'crown', 'balloon', 'halo', 'wings', 'santa', 'antlers', 'scarf'],
  eye: ['round', 'sparkle', 'smile', 'sleepy', 'sharp'],
  brow: ['soft', 'straight', 'arched', 'thick'],
  mouth: ['smile', 'grin', 'small', 'cat', 'neutral'],
  colors: ['skin', 'hair', 'eyeColor', 'top', 'bottom', 'shoes', 'acc'],
  // 슬라이더: [최소, 최대, 기본]
  sliders: { height: [-1, 1, 0], build: [-1, 1, 0], female: [0, 1, 0], long: [0, 1, 0], vline: [0, 1, 0.3], cheek: [0, 1, 0.2],
             eyeSize: [-1, 1, 0], eyeGap: [-1, 1, 0], eyeY: [-1, 1, 0], blush: [0, 1, 0.6] },
};
// 귀여운(chibi) 그림체의 기본 얼굴형 — 동글동글(사용자 요청). 블록은 위 슬라이더 기본값 그대로
export const CHIBI_FACE = { vline: 0, cheek: 0.8 };
const BLOCK_FACE = { vline: LOOK.sliders.vline[2], cheek: LOOK.sliders.cheek[2] };
const isFace = (l, f) => l.vline === f.vline && l.cheek === f.cheek;
// 그림체를 바꿀 때 얼굴형을 손대지 않았으면(기본값이면) 그 그림체의 기본 얼굴형으로 맞춘다
// force: 편집 화면에서 그림체 버튼을 눌렀을 때 — 귀여운은 늘 동그란 얼굴(갸름한 턱·긴 얼굴 없이)로 시작
export function fitFaceToStyle(l, force = false) {
  if (force && l.style === 'chibi') { Object.assign(l, CHIBI_FACE, { long: 0 }); return l; }
  if (force && l.style === 'block') { Object.assign(l, BLOCK_FACE); return l; }
  if (l.style === 'chibi' && isFace(l, BLOCK_FACE)) Object.assign(l, CHIBI_FACE);
  else if (l.style === 'block' && isFace(l, CHIBI_FACE)) Object.assign(l, BLOCK_FACE);
  return l;
}
export const HATS = ['cap', 'beanie', 'crown', 'santa'];
// 황금 열쇠를 모은 날(누적)로 여는 꾸미기 — 잠금 해제 여부는 서버(plazaKeys/{uid}.unlocks)가 판단
export const LOCKED_ACC = { goldkeyring: 3, crown: 10 };
// 포인트로 사는 꾸미기(가격 P) — 산 것은 plazaKeys/{uid}.unlocks에 들어간다
export const SHOP_ACC = { balloon: 300, halo: 500, wings: 1000, santa: 300, antlers: 300, scarf: 200 };
// 시즌 한정: 그 테마일 때만 살 수 있다(산 것은 계속 쓸 수 있음). 값은 themes.js의 테마 id
export const SEASON_ACC = { santa: 'xmas', antlers: 'xmas', scarf: 'xmas' };
export const isLockedAcc = (a) => a in LOCKED_ACC || a in SHOP_ACC;

// 성별에 따라 편집 화면에 보여 줄 선택지(저장·검사는 전체 목록 기준이라 예전 캐릭터도 깨지지 않음)
export const GENDER_OPTIONS = {
  male:   { hair: ['short', 'dandy', 'twoblock', 'spiky', 'bob'], top: ['tee', 'long', 'hoodie', 'shirt'], bottom: ['pants', 'shorts'],
            shoes: ['sneakers', 'boots'], acc: ['glasses', 'cap', 'beanie', 'crossbag', 'goldkeyring', 'crown', 'balloon', 'halo', 'wings', 'santa', 'antlers', 'scarf'] },
  female: { hair: ['long', 'bob', 'ponytail', 'bun'],   // 숏컷은 남성만(2026-11-08)
            top: ['tee', 'long', 'hoodie', 'shirt', 'dress'], bottom: ['pants', 'shorts', 'skirt'],
            shoes: ['sneakers', 'boots'], acc: ['glasses', 'earrings', 'cap', 'beanie', 'crossbag', 'goldkeyring', 'crown', 'balloon', 'halo', 'wings', 'santa', 'antlers', 'scarf'] },
};

// 성별을 바꾸면 그 성별에 없는 선택은 기본값으로 바꾼다(색은 그대로)
export function fitToGender(look, gender) {
  const g = gender === 'female' ? 'female' : 'male', o = GENDER_OPTIONS[g], d = defaultLook(g), out = { ...look, gender: g };
  for (const k of ['hair', 'top', 'bottom', 'shoes']) if (!o[k].includes(out[k])) out[k] = d[k];
  out.acc = (out.acc || []).filter((a) => o.acc.includes(a));
  if (g === 'male') out.female = 0; else if (look.gender !== 'female') out.female = 1;
  // 성별을 바꿀 때 상의 색이 그 성별의 기본색이면 바뀐 성별의 기본색으로(여성 분홍 #f4a6b8 · 남성 하늘색 #7fb3e6)
  if (out.colors) { const top = String(out.colors.top || '').toLowerCase(), want = defaultLook(g).colors.top;
    if ((top === '#7fb3e6' || top === '#f4a6b8') && top !== want) out.colors = { ...out.colors, top: want }; }
  return out;
}

const HEX = /^#[0-9a-f]{6}$/;
const pick = (v, list, def) => (list.includes(v) ? v : def);
const color = (v, def) => (typeof v === 'string' && HEX.test(v.toLowerCase()) ? v.toLowerCase() : def);
const num = (v, [lo, hi, def]) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 100) / 100 : def; };

export function defaultLook(gender = 'male') {
  const f = gender === 'female';
  const look = { v: 2, style: 'block', gender: f ? 'female' : 'male', hair: f ? 'long' : 'short', top: f ? 'dress' : 'hoodie', bottom: 'pants',
    shoes: 'sneakers', acc: [], eye: f ? 'sparkle' : 'round', brow: 'soft', mouth: 'smile',
    skin: '#ffdcc4', hair_c: '#4a2e1c', eyeColor: '#2b2020', top_c: f ? '#f4a6b8' : '#7fb3e6', bottom_c: '#2d3550', shoes_c: '#ffffff', acc_c: '#222222' };
  for (const [k, s] of Object.entries(LOOK.sliders)) look[k] = s[2];
  if (f) look.female = 1;
  return toV2Colors(look);
}

// 색은 { skin, hair, eyeColor, top, bottom, shoes, acc } 묶음(colors)으로 보관
function toV2Colors(l) {
  l.colors = { skin: l.skin, hair: l.hair_c, eyeColor: l.eyeColor, top: l.top_c, bottom: l.bottom_c, shoes: l.shoes_c, acc: l.acc_c };
  for (const k of ['skin', 'hair_c', 'eyeColor', 'top_c', 'bottom_c', 'shoes_c', 'acc_c']) delete l[k];
  return l;
}

// 예전 캐릭터(v1: face·hair·hairColor·eye·clothes)를 v2로
function fromV1(o) {
  const g = o && o.gender === 'female' ? 'female' : 'male', l = defaultLook(g);
  if (o && typeof o === 'object') {
    l.hair = { short: 'short', long: g === 'female' ? 'long' : 'bob', spiky: 'spiky' }[o.hair] || l.hair;
    l.colors.hair = color(o.hairColor, l.colors.hair); l.colors.top = color(o.clothes, l.colors.top);
    if (o.face === 'square') { l.vline = 0; l.cheek = 0.6; } else if (o.face === 'triangle') { l.vline = 1; l.cheek = 0; }
    if (o.eye === 'line') l.eye = 'sleepy';
  }
  return l;
}

export function sanitizeLook(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== 2) return fromV1(raw);
  const d = defaultLook(raw.gender), c = raw.colors && typeof raw.colors === 'object' ? raw.colors : {};
  // 저장된 캐릭터에 그림체가 없으면(예전 것) 귀여운 그대로
  const out = { v: 2, style: pick(raw.style, LOOK.style, 'chibi'), gender: pick(raw.gender, LOOK.gender, 'male') };
  for (const k of ['hair', 'top', 'bottom', 'shoes', 'eye', 'brow', 'mouth']) out[k] = pick(raw[k], LOOK[k], d[k]);
  const acc = Array.isArray(raw.acc) ? [...new Set(raw.acc.filter((a) => LOOK.acc.includes(a)))] : [];
  out.acc = acc.filter((a, i) => !HATS.includes(a) || acc.findIndex((b) => HATS.includes(b)) === i).slice(0, 4);   // 모자는 하나만
  out.colors = {}; for (const k of LOOK.colors) out.colors[k] = color(c[k], d.colors[k]);
  for (const [k, s] of Object.entries(LOOK.sliders)) out[k] = num(raw[k], s);
  // 예전에 만든 귀여운 캐릭터도 얼굴형을 손대지 않았으면 둥근 얼굴로
  if (out.style === 'chibi' && isFace(out, BLOCK_FACE)) Object.assign(out, CHIBI_FACE);
  // 데리고 다니는 반려동물(이름표용). 소유 여부는 가입 API가 plazaPets로 확인
  if (raw.pet && typeof raw.pet === 'object' && PET_IDS.includes(raw.pet.id)) {
    const name = String(raw.pet.name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, PET_NAME_MAX);
    if (name && !hasBadWord(name) && !isReservedNick(name)) out.pet = { id: raw.pet.id, name };
  }
  return out;
}

// 실제로 보이는 부위(원피스면 하의 숨김, 모자를 쓰면 뚫고 나오는 머리는 바꿈)
export function visibleParts(look) {
  const hat = look.acc.some((a) => HATS.includes(a));
  let hair = look.hair;
  if (hat && hair === 'spiky') hair = 'short';
  if (hat && hair === 'bun') hair = 'bob';
  return { hair, top: look.top, bottom: look.top === 'dress' ? null : look.bottom, shoes: look.shoes, acc: look.acc };
}
