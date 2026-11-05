import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { hitLimit, peekLimit, clientIp } from '@/lib/rateLimit';
import {
  NPC_ID, NPC_NICK, NPC_DAILY_LIMIT, NPC_GUEST_DAILY_LIMIT, NPC_GUEST_GLOBAL_DAILY, NPC_HISTORY, NPC_SYSTEM_PROMPT, NPC_STYLE_REMINDER,
  upcomingSessionsText, memoryBlock, foldOldMessagesIntoMemory,
} from '@/lib/plazaNpc';

// 광장 AI NPC "키키"와 대화 — 회원(하루 NPC_DAILY_LIMIT회)과 비회원(기기당 NPC_GUEST_DAILY_LIMIT회) 모두 가능
// 대화 기록은 서버가 저장한 것만 문맥으로 쓴다(클라이언트가 보낸 가짜 AI 답변 끼워넣기 방지).
// 문맥 = 요약 메모(장기 기억) + 최근 NPC_HISTORY개 메시지. 오래된 대화는 응답 후 after()에서 메모로 접는다.
// 비회원은 광장 기기 id(localStorage kl_dev)를 해시한 'npcguest_…' 로 대화방을 만든다 → 같은 기기면 기록·기억이 이어짐.
const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_MODEL = process.env.NPC_MODEL || 'claude-opus-5-5';
const DEV_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']; // 로컬 비교 테스트용
const convOf = (a: string, b: string) => [a, b].sort().join('__');
const guestIdOf = (dev: unknown) => {
  const d = String(dev ?? '');
  return /^[A-Za-z0-9_-]{8,64}$/.test(d) ? 'npcguest_' + crypto.createHash('sha256').update('kl-npc-guest:' + d).digest('hex').slice(0, 24) : null;
};

const client = new Anthropic();

// 로그인 토큰이 있으면 회원, 없으면 기기 id로 비회원
async function whoIs(req: Request, dev: unknown): Promise<{ id: string; guest: boolean } | null> {
  const h = req.headers.get('Authorization');
  if (h?.startsWith('Bearer ')) {
    try { return { id: (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid, guest: false }; } catch { return null; }
  }
  const g = guestIdOf(dev);
  return g ? { id: g, guest: true } : null;
}

// 비회원 전체 하루 사용량(한국 날짜) — 넘으면 비회원만 막는다
async function guestGlobalOk(): Promise<boolean> {
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const ref = adminDb.doc(`rateLimits/npc-guest-global-${day}`);
  const n = ((await ref.get()).get('n') as number) || 0;
  if (n >= NPC_GUEST_GLOBAL_DAILY) return false;
  await ref.set({ n: FieldValue.increment(1), bucket: 'npc-guest-global', expireAt: new Date(Date.now() + 2 * DAY) }, { merge: true });
  return true;
}

// 키키(AI) 대화 기록 + 오늘 남은 대화 횟수 불러오기(회원은 로그인 토큰, 비회원은 기기 id)
export async function GET(req: Request) {
  const who = await whoIs(req, new URL(req.url).searchParams.get('dev'));
  if (!who) return NextResponse.json({ error: 'bad_identity' }, { status: 400 });
  const snap = await adminDb.collection('plazaChats').doc(convOf(who.id, NPC_ID))
    .collection('messages').orderBy('createdAt', 'asc').limitToLast(100).get();
  const messages = snap.docs.map((d) => {
    const x = d.data() as { from?: string; text?: string; cta?: string };
    return { text: x.text, mine: x.from !== NPC_ID, cta: x.cta || null };
  });
  const limit = who.guest ? NPC_GUEST_DAILY_LIMIT : NPC_DAILY_LIMIT;
  const remaining = await peekLimit(who.guest ? 'npc-guest' : 'npc-uid', who.id, limit, DAY);
  return NextResponse.json({ messages, limit, remaining, guest: who.guest });
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const who = await whoIs(req, b.dev);
    if (!who) return NextResponse.json({ error: 'bad_identity' }, { status: 400 });
    const uid = who.id;

    const text = String(b.text ?? '').trim().slice(0, 500);
    if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });
    // 모델 바꿔 보기는 로컬 개발에서만(운영은 NPC_MODEL 환경변수로 고정)
    const model = process.env.NODE_ENV === 'development' && DEV_MODELS.includes(b.model) ? b.model : DEFAULT_MODEL;

    const limit = who.guest ? NPC_GUEST_DAILY_LIMIT : NPC_DAILY_LIMIT;
    const perUser = await hitLimit(who.guest ? 'npc-guest' : 'npc-uid', uid, limit, DAY);
    if (!perUser.ok) return NextResponse.json({ error: 'daily_limit', limit, guest: who.guest }, { status: 429 });
    const perIp = await hitLimit('npc-ip', clientIp(req), NPC_DAILY_LIMIT * 3, DAY);
    if (!perIp.ok) return NextResponse.json({ error: 'daily_limit', limit, guest: who.guest }, { status: 429 });
    if (who.guest && !(await guestGlobalOk())) return NextResponse.json({ error: 'busy' }, { status: 503 });

    const convId = convOf(uid, NPC_ID);
    const convRef = adminDb.collection('plazaChats').doc(convId);
    const [convSnap, histSnap, sessionsText] = await Promise.all([
      convRef.get(),
      convRef.collection('messages').orderBy('createdAt', 'asc').limitToLast(NPC_HISTORY).get(),
      upcomingSessionsText(),
    ]);
    const memory = memoryBlock(convSnap.get('npcMemory'));
    const messages: Anthropic.Beta.BetaMessageParam[] = histSnap.docs.map((d) => {
      const x = d.data() as { from?: string; text?: string };
      return { role: x.from === NPC_ID ? 'assistant' : 'user', content: String(x.text ?? '') };
    });
    while (messages.length && messages[0].role !== 'user') messages.shift(); // 첫 메시지는 user 여야 한다
    // 마지막 메시지까지 캐시 → 다음 턴에는 이전 대화가 캐시 읽기(1/10 가격)로 처리돼 긴 기억도 싸다
    messages.push({ role: 'user', content: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }] });

    const isHaiku = model.startsWith('claude-haiku');
    const response = await client.beta.messages.create({
      model,
      max_tokens: 1500,
      system: [
        { type: 'text', text: NPC_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }, // 고정 부분 캐싱
        ...(memory ? [{ type: 'text' as const, text: memory }] : []),                     // 장기 기억(가끔 바뀜)
        { type: 'text', text: sessionsText },                                            // 바뀌는 일정은 캐시 뒤에
        { type: 'text', text: NPC_STYLE_REMINDER },                                      // 말투 다짐은 맨 끝에
      ],
      messages,
      output_config: { effort: 'low' }, // 잡담·안내는 낮은 노력으로 충분
      // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도(Opus·Sonnet만; Haiku는 지원 안 함)
      ...(isHaiku ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
    });

    let reply = '';
    if (response.stop_reason === 'refusal') {
      reply = '그 얘기는 제가 도와드리기 어려워요. 광장 사용법이나 소개팅 이야기라면 언제든 물어봐 주세요 😊';
    } else {
      for (const block of response.content) if (block.type === 'text') reply += block.text;
      reply = reply.trim() || '앗, 잠깐 말이 막혔어요. 다시 한 번 말해 주시겠어요?';
    }
    // [신청버튼] 표시 → 화면에 '신청하러 가기' 버튼. 채팅창은 링크를 못 누르므로 웹 주소는 지운다(주소가 있었으면 버튼으로 대신)
    let cta = /\[신청버튼\]/.test(reply) || /keylink\.kr/i.test(reply);
    reply = reply.replace(/\[신청버튼\]/g, '').replace(/\(?\s*https?:\/\/[^\s)]+\s*\)?/g, '').replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?])/g, '$1').trim();
    if (!reply) { reply = '아래 버튼으로 신청할 수 있어요.'; cta = true; }

    // 저장(회원 1:1과 같은 구조 → 기록 이어짐, 관리자 열람 가능)
    const myNick = String(b.myNick ?? '').trim().slice(0, 12);
    const now = FieldValue.serverTimestamp();
    await convRef.collection('messages').add({ from: uid, text, createdAt: now });
    await convRef.collection('messages').add({ from: NPC_ID, text: reply, createdAt: FieldValue.serverTimestamp(), model: response.model, ...(cta ? { cta: 'apply' } : {}) });
    await convRef.set({
      participants: [uid, NPC_ID].sort(),
      nicks: { [NPC_ID]: NPC_NICK + ' (AI)', ...(myNick ? { [uid]: who.guest ? myNick + ' (비회원)' : myNick } : {}) },
      lastMessage: reply, lastFrom: NPC_ID, lastAt: now, updatedAt: now, isNpc: true,
      ...(who.guest ? { isGuest: true } : {}),
      ...(convSnap.exists ? {} : { createdAt: now }),
    }, { merge: true });

    // 응답을 보낸 뒤 오래된 대화를 요약 메모로 접는다(사용자 대기시간에 영향 없음)
    after(() => foldOldMessagesIntoMemory(client, model, convId).catch((e) => console.error('[plaza npc] memory', e)));

    return NextResponse.json({ reply, cta: cta ? 'apply' : null, remaining: perUser.remaining, limit, guest: who.guest, model: response.model, usage: process.env.NODE_ENV === 'development' ? response.usage : undefined });
  } catch (e: unknown) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'busy' }, { status: 503 });
    if (e instanceof Anthropic.APIError) {
      console.error('[plaza npc] API error', e.status, e.message);
      return NextResponse.json({ error: 'ai_error' }, { status: 502 });
    }
    console.error('[plaza npc]', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
