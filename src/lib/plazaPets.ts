import { adminDb } from '@/lib/firebaseAdmin';
import { seoulToday } from '@/lib/points';
import { PET_IDS, AFF, PET_DAILY, PET_COOLDOWN_MS, PET_NAME_MAX, ADOPT_MAX, currentAff, petGain } from '../../public/plaza/pets.js';
import { hasBadWord, isReservedNick } from '../../public/plaza/badwords.js';

// 키링 월드 동물 호감(회원만 저장) — plazaPets/{uid} = { aff:{id:n}, affAt:{id:마지막 돌본 시각}, day, petCount:{id:n}, lastPetAt, adopted:{id:name}, active }
// 저장된 호감은 돌본 시점 값이고, 지금 호감은 currentAff(값, 시각)로 계산한다(하루 지나면 하루 5씩 감소).
export class PetError extends Error { constructor(public code: string) { super(code); } }
export type PetState = { aff: Record<string, number>; adopted: Record<string, string>; active: string | null; petLeft: Record<string, number> };

const ref = (uid: string) => adminDb.doc(`plazaPets/${uid}`);
function view(d: FirebaseFirestore.DocumentData | undefined): PetState {
  const today = seoulToday(), counts = d?.day === today ? d?.petCount || {} : {};
  const petLeft: Record<string, number> = {}; for (const id of PET_IDS) petLeft[id] = Math.max(0, PET_DAILY - (counts[id] || 0));
  const aff: Record<string, number> = {}; for (const [id, n] of Object.entries(d?.aff || {})) aff[id] = currentAff(n, d?.affAt?.[id]);
  return { aff, adopted: d?.adopted || {}, active: d?.active || null, petLeft };
}
export async function petState(uid: string) { return view((await ref(uid).get()).data()); }

export async function petAnimal(uid: string, id: string) {
  if (!PET_IDS.includes(id)) throw new PetError('bad_pet');
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref(uid)); const d = snap.data() || {}; const today = seoulToday();
    if (Date.now() - (d.lastPetAt || 0) < PET_COOLDOWN_MS) throw new PetError('cooldown');
    const counts = d.day === today ? { ...(d.petCount || {}) } : {};
    if ((counts[id] || 0) >= PET_DAILY) throw new PetError('daily');
    counts[id] = (counts[id] || 0) + 1;
    const cur = currentAff(d.aff?.[id], d.affAt?.[id]);
    const aff = { ...(d.aff || {}), [id]: Math.min(AFF.max, cur + petGain(cur)) }, affAt = { ...(d.affAt || {}), [id]: Date.now() };
    const next = { ...d, aff, affAt, day: today, petCount: counts, lastPetAt: Date.now() };
    tx.set(ref(uid), { aff, affAt, day: today, petCount: counts, lastPetAt: Date.now() }, { merge: true });
    return view(next);
  });
}

/** 상점 밥주기 트랜잭션 안에서 호감 올리기(읽기는 호출 쪽에서 먼저 해 둔 문서 데이터를 넘김) */
export function feedAffInTx(tx: FirebaseFirestore.Transaction, uid: string, d: FirebaseFirestore.DocumentData | undefined, id: string, amount: number) {
  if (!PET_IDS.includes(id)) return;
  const cur = currentAff(d?.aff?.[id], d?.affAt?.[id]);
  tx.set(ref(uid), { aff: { ...(d?.aff || {}), [id]: Math.min(AFF.max, cur + amount) }, affAt: { ...(d?.affAt || {}), [id]: Date.now() } }, { merge: true });
}
export const petRef = ref;

export async function adoptPet(uid: string, id: string, raw: unknown) {
  if (!PET_IDS.includes(id)) throw new PetError('bad_pet');
  const name = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, PET_NAME_MAX);
  if (!name) throw new PetError('empty');
  if (hasBadWord(name) || isReservedNick(name)) throw new PetError('bad_name');
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref(uid)); const d = snap.data() || {};
    if (currentAff(d.aff?.[id], d.affAt?.[id]) < AFF.adopt) throw new PetError('need_aff');
    const adopted = { ...(d.adopted || {}) };
    if (!adopted[id] && Object.keys(adopted).length >= ADOPT_MAX) throw new PetError('max');
    adopted[id] = name;
    tx.set(ref(uid), { adopted, active: id }, { merge: true });
    return view({ ...d, adopted, active: id });
  });
}

export async function setActivePet(uid: string, id: string | null) {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref(uid)); const d = snap.data() || {};
    if (id && !(d.adopted || {})[id]) throw new PetError('not_adopted');
    tx.set(ref(uid), { active: id || null }, { merge: true });
    return view({ ...d, active: id || null });
  });
}
