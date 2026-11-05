// 키링 월드 캐릭터 정보(look v2) — 웹·가입 API·워커가 같이 쓰는 규칙. 설계: plaza-blender/avatar_spec.md
// 허용된 값만 남기고 나머지는 버린다(다른 사람에게 그대로 전달되므로 외모 정보 외에는 절대 넣지 않는다).

export const LOOK = {
  style: ['chibi'],
  gender: ['male', 'female'],
  hair: ['short', 'dandy', 'twoblock', 'spiky', 'bob', 'long', 'ponytail', 'bun'],
  top: ['tee', 'long', 'hoodie', 'shirt', 'dress'],
  bottom: ['pants', 'shorts', 'skirt'],
  shoes: ['sneakers', 'boots'],
  acc: ['glasses', 'cap', 'beanie', 'earrings', 'crossbag'],
  eye: ['round', 'sparkle', 'smile', 'sleepy', 'sharp'],
  brow: ['soft', 'straight', 'arched', 'thick'],
  mouth: ['smile', 'grin', 'small', 'cat', 'neutral'],
  colors: ['skin', 'hair', 'eyeColor', 'top', 'bottom', 'shoes', 'acc'],
  // 슬라이더: [최소, 최대, 기본]
  sliders: { height: [-1, 1, 0], build: [-1, 1, 0], female: [0, 1, 0], long: [0, 1, 0], vline: [0, 1, 0.3], cheek: [0, 1, 0.2],
             eyeSize: [-1, 1, 0], eyeGap: [-1, 1, 0], eyeY: [-1, 1, 0], blush: [0, 1, 0.6] },
};
export const HATS = ['cap', 'beanie'];

// 성별에 따라 편집 화면에 보여 줄 선택지(저장·검사는 전체 목록 기준이라 예전 캐릭터도 깨지지 않음)
export const GENDER_OPTIONS = {
  male:   { hair: ['short', 'dandy', 'twoblock', 'spiky', 'bob'], top: ['tee', 'long', 'hoodie', 'shirt'], bottom: ['pants', 'shorts'],
            shoes: ['sneakers', 'boots'], acc: ['glasses', 'cap', 'beanie', 'crossbag'] },
  female: { hair: ['long', 'bob', 'ponytail', 'bun', 'short'], top: ['tee', 'long', 'hoodie', 'shirt', 'dress'], bottom: ['pants', 'shorts', 'skirt'],
            shoes: ['sneakers', 'boots'], acc: ['glasses', 'earrings', 'cap', 'beanie', 'crossbag'] },
};

// 성별을 바꾸면 그 성별에 없는 선택은 기본값으로 바꾼다(색은 그대로)
export function fitToGender(look, gender) {
  const g = gender === 'female' ? 'female' : 'male', o = GENDER_OPTIONS[g], d = defaultLook(g), out = { ...look, gender: g };
  for (const k of ['hair', 'top', 'bottom', 'shoes']) if (!o[k].includes(out[k])) out[k] = d[k];
  out.acc = (out.acc || []).filter((a) => o.acc.includes(a));
  if (g === 'male') out.female = 0; else if (look.gender !== 'female') out.female = 1;
  return out;
}

const HEX = /^#[0-9a-f]{6}$/;
const pick = (v, list, def) => (list.includes(v) ? v : def);
const color = (v, def) => (typeof v === 'string' && HEX.test(v.toLowerCase()) ? v.toLowerCase() : def);
const num = (v, [lo, hi, def]) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 100) / 100 : def; };

export function defaultLook(gender = 'male') {
  const f = gender === 'female';
  const look = { v: 2, style: 'chibi', gender: f ? 'female' : 'male', hair: f ? 'long' : 'short', top: f ? 'dress' : 'hoodie', bottom: 'pants',
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
  const out = { v: 2, style: pick(raw.style, LOOK.style, 'chibi'), gender: pick(raw.gender, LOOK.gender, 'male') };
  for (const k of ['hair', 'top', 'bottom', 'shoes', 'eye', 'brow', 'mouth']) out[k] = pick(raw[k], LOOK[k], d[k]);
  const acc = Array.isArray(raw.acc) ? [...new Set(raw.acc.filter((a) => LOOK.acc.includes(a)))] : [];
  out.acc = acc.filter((a, i) => !HATS.includes(a) || acc.findIndex((b) => HATS.includes(b)) === i).slice(0, 4);   // 모자는 하나만
  out.colors = {}; for (const k of LOOK.colors) out.colors[k] = color(c[k], d.colors[k]);
  for (const [k, s] of Object.entries(LOOK.sliders)) out[k] = num(raw[k], s);
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
