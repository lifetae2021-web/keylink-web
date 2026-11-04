import { NextResponse, after } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { hitLimit, clientIp } from '@/lib/rateLimit';
import {
  NPC_ID, NPC_NICK, NPC_DAILY_LIMIT, NPC_HISTORY, NPC_SYSTEM_PROMPT,
  upcomingSessionsText, memoryBlock, foldOldMessagesIntoMemory,
} from '@/lib/plazaNpc';

// 광장 AI NPC "큐피드"와 대화 (회원 전용, 하루 NPC_DAILY_LIMIT회)
// 대화 기록은 서버가 저장한 것만 문맥으로 쓴다(클라이언트가 보낸 가짜 AI 답변 끼워넣기 방지).
// 문맥 = 요약 메모(장기 기억) + 최근 NPC_HISTORY개 메시지. 오래된 대화는 응답 후 after()에서 메모로 접는다.
const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_MODEL = process.env.NPC_MODEL || 'claude-opus-5-5';
const DEV_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']; // 로컬 비교 테스트용
const convOf = (a: string, b: string) => [a, b].sort().join('__');

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;

    const b = await req.json().catch(() => ({}));
    const text = String(b.text ?? '').trim().slice(0, 500);
    if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });
    // 모델 바꿔 보기는 로컬 개발에서만(운영은 NPC_MODEL 환경변수로 고정)
    const model = process.env.NODE_ENV === 'development' && DEV_MODELS.includes(b.model) ? b.model : DEFAULT_MODEL;

    const perUser = await hitLimit('npc-uid', uid, NPC_DAILY_LIMIT, DAY);
    if (!perUser.ok) return NextResponse.json({ error: 'daily_limit', limit: NPC_DAILY_LIMIT }, { status: 429 });
    const perIp = await hitLimit('npc-ip', clientIp(req), NPC_DAILY_LIMIT * 3, DAY);
    if (!perIp.ok) return NextResponse.json({ error: 'daily_limit', limit: NPC_DAILY_LIMIT }, { status: 429 });

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

    // 저장(회원 1:1과 같은 구조 → 기록 이어짐, 관리자 열람 가능)
    const myNick = String(b.myNick ?? '').trim().slice(0, 12);
    const now = FieldValue.serverTimestamp();
    const existed = convSnap.exists;
    await convRef.collection('messages').add({ from: uid, text, createdAt: now });
    await convRef.collection('messages').add({ from: NPC_ID, text: reply, createdAt: FieldValue.serverTimestamp(), model: response.model });
    await convRef.set({
      participants: [uid, NPC_ID].sort(),
      nicks: { [NPC_ID]: NPC_NICK + ' (AI)', ...(myNick ? { [uid]: myNick } : {}) },
      lastMessage: reply, lastFrom: NPC_ID, lastAt: now, updatedAt: now, isNpc: true,
      ...(existed ? {} : { createdAt: now }),
    }, { merge: true });

    // 응답을 보낸 뒤 오래된 대화를 요약 메모로 접는다(사용자 대기시간에 영향 없음)
    after(() => foldOldMessagesIntoMemory(client, model, convId).catch((e) => console.error('[plaza npc] memory', e)));

    return NextResponse.json({ reply, model: response.model, usage: process.env.NODE_ENV === 'development' ? response.usage : undefined });
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
