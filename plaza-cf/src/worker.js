// 키링크 광장 실시간 서버 (Cloudflare Worker + Durable Objects)
// - 정적 파일(광장 화면)은 Vercel(keylink.kr/plaza)에 있으므로, 이 Worker는 실시간 /ws 만 담당한다.
// - 방(room) 하나 = PlazaRoom DO 하나.
//   · 광장(plaza)은 모두가 모이는 하나의 허브 방(정원 PLAZA_CAP).
//   · 지역(?region=busan 등, 추후 택시로 이동)은 사람이 많아지면 busan-01, busan-02… 로 자동 분할.
// 로컬 실행:  cd plaza-cf && npx wrangler dev      (ws://127.0.0.1:8787/ws)
// 배포:       npx wrangler deploy
export { PlazaRoom } from './room.js';
export { PlazaRegistry } from './registry.js';

const PLAZA_CAP = 100; // 광장 허브 정원 (산사와 동일)
const REGION_CAP = 30; // 지역 채널 하나당 정원 (넘치면 다음 채널)
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

    // 방 목록 + 인원 (추후 채널 선택 UI용)
    if (url.pathname === '/api/rooms') {
      const res = await registry(env).fetch('https://do/list');
      return new Response(await res.text(), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      let room = (url.searchParams.get('room') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24);
      const region = (url.searchParams.get('region') || '').replace(/[^a-z]/gi, '').slice(0, 16).toLowerCase();
      let cap = PLAZA_CAP;
      if (!room && region) {
        // 지역: 빈 자리 있는 채널로 자동 배치 (busan-01, busan-02…)
        const r = await registry(env).fetch('https://do/place?prefix=' + region + '&cap=' + REGION_CAP);
        room = (await r.json()).room;
        cap = REGION_CAP;
      } else if (!room) {
        room = 'plaza'; // 광장은 하나
      } else if (room !== 'plaza') {
        cap = REGION_CAP;
      }
      const stub = env.PLAZA_ROOM.get(env.PLAZA_ROOM.idFromName(room));
      return stub.fetch(new Request('https://do/ws?room=' + encodeURIComponent(room) + '&cap=' + cap, request));
    }

    return new Response('keylink plaza worker', { headers: CORS });
  },
};
