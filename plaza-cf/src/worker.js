// 키링크 광장 실시간 서버 (Cloudflare Worker + Durable Objects)
// - 정적 파일(광장 화면)은 Vercel(keylink.kr/plaza)에 있으므로, 이 Worker는 실시간 /ws 만 담당한다.
// - 방(room) 하나 = PlazaRoom DO 하나.
//   · 광장(plaza)은 모두가 모이는 하나의 허브 방(정원 PLAZA_CAP).
//   · 지역(?region=busan 등, 추후 택시로 이동)은 사람이 많아지면 busan-01, busan-02… 로 자동 분할.
// - /admin/* 은 Next 서버(관리자 페이지)만 부를 수 있다: 헤더 x-plaza-secret = PLAZA_ADMIN_SECRET
//   (로컬: plaza-cf/.dev.vars, 운영: npx wrangler secret put PLAZA_ADMIN_SECRET)
// 로컬 실행:  cd plaza-cf && npx wrangler dev      (ws://127.0.0.1:8787/ws)
// 배포:       npx wrangler deploy
// - 운영 점검용 테스트 접속: ?kltest=<PLAZA_TEST_KEY> 가 맞으면 접속 기록·동시접속 통계에서 뺀다
//   (키를 모르는 일반 이용자는 기록에서 숨을 수 없음. 운영: npx wrangler secret put PLAZA_TEST_KEY)
import { shortHash } from './hash.js';
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

async function handleAdmin(request, env, url) {
  if (!env.PLAZA_ADMIN_SECRET || request.headers.get('x-plaza-secret') !== env.PLAZA_ADMIN_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  const body = await request.text();
  const res = await registry(env).fetch('https://do' + url.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  const out = await res.json();
  // 차단했으면 지금 접속 중인 방들에서도 바로 내보낸다
  if (url.pathname === '/admin/ban' && out.ok) {
    const { tid } = JSON.parse(body);
    const rooms = ['plaza', ...((await (await registry(env).fetch('https://do/list')).json()).rooms || []).map((r) => r.name)];
    for (const room of [...new Set(rooms)]) {
      try { await env.PLAZA_ROOM.get(env.PLAZA_ROOM.idFromName(room)).fetch('https://do/kick?tid=' + encodeURIComponent(tid) + '&until=' + out.until); } catch (e) {}
    }
  }
  return Response.json(out, { status: res.status });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname.startsWith('/admin/')) return handleAdmin(request, env, url);

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
        const r = await registry(env).fetch('https://do/place?prefix=' + region + '&cap=' + REGION_CAP);
        room = (await r.json()).room;
        cap = REGION_CAP;
      } else if (!room) {
        room = 'plaza'; // 광장은 하나
      } else if (room !== 'plaza') {
        cap = REGION_CAP;
      }
      // 입장 금지용 신원: IP·기기 표식은 해시로만 넘긴다(원문 저장 안 함)
      const ipRaw = request.headers.get('CF-Connecting-IP') || '';
      const devRaw = (url.searchParams.get('dev') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
      const ip = ipRaw ? await shortHash('kl-ip:', ipRaw) : '';
      const dev = devRaw ? await shortHash('kl-dev:', devRaw) : '';
      const stub = env.PLAZA_ROOM.get(env.PLAZA_ROOM.idFromName(room));
      const test = env.PLAZA_TEST_KEY && url.searchParams.get('kltest') === env.PLAZA_TEST_KEY ? '1' : '';
      const q = new URLSearchParams({ room, cap: String(cap), ip, dev, test });
      return stub.fetch(new Request('https://do/ws?' + q.toString(), request));
    }

    return new Response('keylink plaza worker', { headers: CORS });
  },
};
