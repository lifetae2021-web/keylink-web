// 광장의 방 하나 = PlazaRoom DO 하나.
// WebSocket Hibernation API를 써서, 소켓이 조용할 때 메모리에서 재워 과금을 아낀다.
// 접속자별 메타데이터(닉/룩/위치/신원 해시)는 소켓 attachment에 저장해 재우기/깨우기 후에도 유지한다.
//
// 신원(모두 되돌릴 수 없는 해시, 원문 저장 안 함)
//   key  : 회원 uid 해시 — 회원 구분(차단·신고), 모두에게 보여도 uid는 알 수 없음
//   gkey : 기기 표식 해시 — 손님 구분(신고용)
//   ip/dev : IP·기기 해시 — 입장 금지에만 쓰고 다른 사람에게는 절대 보내지 않음
//   tid  : 신고·차단 대상 ID = 'k:'+key(회원) 또는 'g:'+gkey(손님)
import { nickProblem } from '../../public/plaza/badwords.js';
import { shortHash } from './hash.js';

const AUTO_BAN_REPORTERS = 5;             // 서로 다른 회원 5명이
const AUTO_BAN_WINDOW_MS = 10 * 60 * 1000; // 10분 안에 신고하면
const AUTO_BAN_HOURS = 24;                // 24시간 입장 금지

export class PlazaRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  registry() {
    return this.env.PLAZA_REGISTRY.get(this.env.PLAZA_REGISTRY.idFromName('registry'));
  }
  async reg(path, body) {
    const init = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined;
    return this.registry().fetch('https://do' + path, init);
  }
  async bumpRegistry(room, delta) {
    try { await this.reg('/inc?room=' + encodeURIComponent(room) + '&delta=' + delta); } catch (e) {}
  }

  clean(s, n) { return String(s ?? '').slice(0, n); }
  attach(ws) { try { return ws.deserializeAttachment(); } catch (e) { return null; } }
  save(ws, a) { try { ws.serializeAttachment(a); } catch (e) {} }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
  broadcast(exceptWs, obj) {
    const s = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      if (ws === exceptWs) continue;
      try { ws.send(s); } catch (e) {}
    }
  }
  // 입장 금지 안내 후 연결 종료
  kickBanned(ws, until, reason) {
    this.send(ws, { t: 'banned', until, reason });
    try { ws.close(4003, 'banned'); } catch (e) {}
  }

  async fetch(request) {
    const url = new URL(request.url);

    // 관리자 차단 시 지금 접속 중인 대상 내보내기 (워커 /admin/ban 이 호출)
    if (url.pathname === '/kick') {
      const tid = url.searchParams.get('tid');
      const until = +url.searchParams.get('until') || 0;
      let n = 0;
      for (const ws of this.state.getWebSockets()) {
        const a = this.attach(ws);
        if (a && a.tid === tid) { this.kickBanned(ws, until, 'admin'); n++; }
      }
      return Response.json({ kicked: n });
    }

    const room = this.clean(url.searchParams.get('room') || 'plaza', 24);
    const cap = +url.searchParams.get('cap') || 30;
    const ip = this.clean(url.searchParams.get('ip'), 16);
    const dev = this.clean(url.searchParams.get('dev'), 16);

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    // 방이 꽉 찼으면 안내 후 종료
    if (this.state.getWebSockets().length >= cap) {
      const full = new WebSocketPair();
      full[1].accept();
      full[1].send(JSON.stringify({ t: 'full', room, cap }));
      full[1].close(4000, 'room full');
      return new Response(null, { status: 101, webSocket: full[0] });
    }

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    const id = 'u' + Math.random().toString(36).slice(2, 8);

    this.state.acceptWebSocket(server);
    this.save(server, { id, room, ip, dev, nick: null, look: null, st: { x: 0, z: 11, ry: 0 } });
    await this.bumpRegistry(room, 1);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    let m;
    try { m = JSON.parse(message); } catch (e) { return; }
    const a = this.attach(ws);
    if (!a) return;

    if (m.t === 'hello') {
      a.nick = this.clean(m.nick || '손님', 12);
      if (nickProblem(a.nick)) a.nick = '손님'; // 비속어·자음만 닉네임 차단
      a.look = (m.look && typeof m.look === 'object') ? m.look : {};
      a.uid = m.uid ? this.clean(m.uid, 128) : null; // 회원 uid(영속 DM 대화방 키용). 1:1 상대에게만 전달.
      a.key = a.uid ? await shortHash('kl-plaza:', a.uid) : null;
      a.gkey = a.key ? null : await shortHash('kl-guest:', a.dev || a.id);
      a.tid = a.key ? 'k:' + a.key : 'g:' + a.gkey;

      // 입장 금지 확인 (IP·기기·회원 중 하나라도 걸리면)
      try {
        const r = await (await this.reg('/banned?ip=' + a.ip + '&dev=' + a.dev + '&key=' + (a.key || '') + '&member=' + (a.key ? '1' : '0'))).json();
        if (r.banned) { this.save(ws, a); this.kickBanned(ws, r.until, 'banned'); return; }
      } catch (e) {}
      try { await this.reg('/seen', { tid: a.tid, ip: a.ip, dev: a.dev, key: a.key, nick: a.nick }); } catch (e) {}

      this.save(ws, a);
      const peers = [];
      for (const p of this.state.getWebSockets()) {
        if (p === ws) continue;
        const pa = this.attach(p);
        if (pa && pa.nick) peers.push({ id: pa.id, nick: pa.nick, look: pa.look, state: pa.st, key: pa.key || null, gkey: pa.gkey || null });
      }
      this.send(ws, { t: 'welcome', id: a.id, room: a.room, nick: a.nick, peers });
      this.broadcast(ws, { t: 'join', id: a.id, nick: a.nick, look: a.look, state: a.st, key: a.key || null, gkey: a.gkey || null });
    } else if (m.t === 'pos') {
      a.st = { x: +m.x || 0, z: +m.z || 0, ry: +m.ry || 0 };
      this.save(ws, a);
      this.broadcast(ws, { t: 'peer', id: a.id, x: a.st.x, z: a.st.z, ry: a.st.ry });
    } else if (m.t === 'report') {
      // 회원만 신고 집계에 참여 (악용 방지: 서로 다른 회원 5명이어야 자동 조치)
      if (!a.key) return;
      const to = this.clean(m.to, 12);
      for (const p of this.state.getWebSockets()) {
        const pa = this.attach(p);
        if (!pa || pa.id !== to || pa.tid === a.tid) continue;
        try {
          const r = await (await this.reg('/report', {
            tid: pa.tid, reporter: a.key, target: { ip: pa.ip, dev: pa.dev, key: pa.key },
            threshold: AUTO_BAN_REPORTERS, windowMs: AUTO_BAN_WINDOW_MS, hours: AUTO_BAN_HOURS,
          })).json();
          if (r.ban) this.kickBanned(p, r.until, 'reports');
        } catch (e) {}
        break;
      }
    } else if (m.t === 'req' || m.t === 'accept' || m.t === 'chat' || m.t === 'chatbye') {
      const to = this.clean(m.to, 12);
      for (const p of this.state.getWebSockets()) {
        const pa = this.attach(p);
        if (pa && pa.id === to) {
          // uid는 1:1 상대에게만 실어 보낸다(영속 DM 대화방 매칭용). 방 전체엔 노출 안 함.
          if (m.t === 'chat') this.send(p, { t: 'chat', from: a.id, nick: a.nick, uid: a.uid, key: a.key || null, text: this.clean(m.text, 1000) });
          else this.send(p, { t: m.t, from: a.id, nick: a.nick, uid: a.uid, key: a.key || null }); // req / accept / chatbye(대화방 나감)
          break;
        }
      }
    }
  }

  async webSocketClose(ws) { await this.onGone(ws); }
  async webSocketError(ws) { await this.onGone(ws); }
  async onGone(ws) {
    const a = this.attach(ws);
    if (!a || a.gone) return;
    a.gone = true; this.save(ws, a);
    if (a.nick) this.broadcast(ws, { t: 'leave', id: a.id });
    await this.bumpRegistry(a.room, -1);
  }
}
