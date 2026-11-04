// 키링크 광장 실시간 서버 (Cloudflare Worker + Durable Objects)
// - 정적 파일(광장 화면)은 Vercel(keylink.kr/plaza)에 있으므로, 이 Worker는 실시간 /ws 만 담당한다.
// - 방(room) 하나 = PlazaRoom DO 하나. 캡(CAP)이 차면 자동으로 다음 방에 배치한다.
// - 접속자 수 집계/배치는 단일 PlazaRegistry DO가 담당한다.
// 로컬 실행:  cd plaza-cf && npx wrangler dev      (ws://localhost:8787/ws)
// 배포:       npx wrangler deploy                   (wss://keylink-plaza.<계정>.workers.dev/ws)
export { PlazaRoom } from './room.js';
export { PlazaRegistry } from './registry.js';

const CAP = 30; // 방당 인원 상한 (산사는 100, 가이드는 30 — 우리는 30으로 시작)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

function registry(env) {
  return env.PLAZA_REGISTRY.get(env.PLAZA_REGISTRY.idFromName('registry'));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // 채널 목록 + 인원 (채널 선택 UI용)
    if (url.pathname === '/api/rooms') {
      const res = await registry(env).fetch('https://do/list?cap=' + CAP);
      const body = await res.text();
      return new Response(body, { headers: { 'content-type': 'application/json', ...CORS } });
    }

    // 실시간 연결
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      // 방 결정: ?room=이름 지정 시 그 방, 아니면 빈 자리 있는 방으로 자동 배치
      let room = (url.searchParams.get('room') || '').slice(0, 24);
      if (!room) {
        const r = await registry(env).fetch('https://do/place?cap=' + CAP);
        room = (await r.json()).room;
      }
      const stub = env.PLAZA_ROOM.get(env.PLAZA_ROOM.idFromName(room));
      const fwd = new Request('https://do/ws?room=' + encodeURIComponent(room) + '&cap=' + CAP, request);
      return stub.fetch(fwd);
    }

    return new Response('keylink plaza worker', { headers: CORS });
  },
};
