import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { petState, petAnimal, adoptPet, setActivePet, PetError } from '@/lib/plazaPets';

// 키링 월드 동물 호감 — GET 내 호감·반려동물 / POST { action: 'pet'|'adopt'|'active', id, name? }
async function uidOf(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { const d = await adminAuth.verifyIdToken(h.split('Bearer ')[1]); return d.firebase?.sign_in_provider === 'anonymous' ? null : d.uid; } catch { return null; }
}
const MSG: Record<string, string> = {
  bad_pet: '없는 동물이에요', cooldown: '조금 있다가 다시 쓰다듬어 주세요', daily: '오늘은 충분히 쓰다듬었어요. 내일 또 와 주세요',
  empty: '이름을 지어 주세요', bad_name: '그 이름은 쓸 수 없어요', need_aff: '호감이 가득 차야 데려갈 수 있어요', max: '반려동물은 3마리까지 데려갈 수 있어요', not_adopted: '내 반려동물이 아니에요',
};
export async function GET(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await petState(uid));
}
export async function POST(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized', message: '회원이 되면 호감을 쌓을 수 있어요' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const id = String(b.id || '');
    const out = b.action === 'pet' ? await petAnimal(uid, id) : b.action === 'adopt' ? await adoptPet(uid, id, b.name) : b.action === 'active' ? await setActivePet(uid, b.id ? id : null) : null;
    if (!out) return NextResponse.json({ error: 'bad_action' }, { status: 400 });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const code = e instanceof PetError ? e.code : 'error';
    if (code === 'error') console.error('[plaza pets]', e);
    return NextResponse.json({ error: code, message: MSG[code] || '잠시 후 다시 시도해 주세요' }, { status: code === 'error' ? 500 : 400 });
  }
}
