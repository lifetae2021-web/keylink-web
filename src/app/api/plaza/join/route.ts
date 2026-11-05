import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { nickProblem } from '../../../../../public/plaza/badwords.js';
import { sanitizeLook, LOCKED_ACC } from '../../../../../public/plaza/look.js';
import { plazaKey } from '@/lib/plazaKey';

// 광장(플라자) 회원 가입/프로필 저장
// 로그인한 본인이 캐릭터·기본정보를 저장한다. 닉네임은 광장 내에서 중복 불가.
// 서버(Admin SDK)에서만 쓰므로 Firestore 규칙은 plazaProfiles 클라이언트 쓰기를 막아둔다.

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const NICK_LOCK_MS = 24 * 60 * 60 * 1000; // 닉네임 변경 잠금 24시간

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));

    const nick = str(body.nick, 12);
    const gender = body.gender === 'female' ? 'female' : 'male';
    const region = str(body.region, 12);
    const birthYear = str(body.birthYear, 4);
    const job = str(body.job, 20);
    const intro = str(body.intro, 40);
    // 캐릭터 외모(look v2): 허용된 값만 남김(공용 규칙 public/plaza/look.js)
    const look = sanitizeLook({ ...(body.look && typeof body.look === 'object' ? body.look : {}), gender });
    // 열쇠 보상 꾸미기(황금 키링·왕관)는 잠금 해제한 회원만
    if (look.acc.some((a: string) => a in LOCKED_ACC)) {
      const unlocks: string[] = (await adminDb.doc(`plazaKeys/${uid}`).get()).data()?.unlocks || [];
      look.acc = look.acc.filter((a: string) => !(a in LOCKED_ACC) || unlocks.includes(a));
    }

    if (!nick) return NextResponse.json({ error: 'nick_required' }, { status: 400 });
    const np = nickProblem(nick);
    if (np === 'jamo') return NextResponse.json({ error: 'nick_jamo' }, { status: 400 });
    if (np === 'bad') return NextResponse.json({ error: 'nick_bad' }, { status: 400 });
    if (!region) return NextResponse.json({ error: 'region_required' }, { status: 400 });
    if (!/^(19|20)\d\d$/.test(birthYear)) return NextResponse.json({ error: 'birthYear_invalid' }, { status: 400 });

    const nickLower = nick.toLowerCase();

    // 닉네임 중복 검사: 다른 uid가 같은 닉을 쓰고 있으면 거절
    const dup = await adminDb.collection('plazaProfiles')
      .where('nickLower', '==', nickLower).limit(1).get();
    if (!dup.empty && dup.docs[0].id !== uid) {
      return NextResponse.json({ error: 'nickname_taken' }, { status: 409 });
    }

    const ref = adminDb.collection('plazaProfiles').doc(uid);
    const prev = await ref.get();
    const existed = prev.exists;
    const prevData = prev.data() || {};

    // 닉네임은 한 번 정하면 24시간 동안 변경 불가
    const nickChanged = !existed || prevData.nickLower !== nickLower;
    const changedAtMs: number | null = prevData.nickChangedAt?.toMillis?.() ?? null;
    if (existed && nickChanged && changedAtMs && Date.now() - changedAtMs < NICK_LOCK_MS) {
      return NextResponse.json({
        error: 'nick_locked',
        nickLockedUntil: changedAtMs + NICK_LOCK_MS,
        nick: prevData.nick,
      }, { status: 429 });
    }

    await ref.set({
      uid, key: plazaKey(uid), nick, nickLower, gender, region, birthYear, job, intro, look,
      updatedAt: FieldValue.serverTimestamp(),
      ...(nickChanged ? { nickChangedAt: FieldValue.serverTimestamp() } : {}),
      ...(existed ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });

    const lockedFrom = nickChanged ? Date.now() : changedAtMs;
    return NextResponse.json({
      ok: true,
      profile: { nick, gender, region, birthYear, job, intro, look, nickLockedUntil: lockedFrom ? lockedFrom + NICK_LOCK_MS : null },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
