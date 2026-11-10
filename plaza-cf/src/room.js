// 광장의 방 하나 = PlazaRoom DO 하나.
// WebSocket Hibernation API를 써서, 소켓이 조용할 때 메모리에서 재워 과금을 아낀다.
// 접속자별 메타데이터(닉/룩/위치/신원 해시)는 소켓 attachment에 저장해 재우기/깨우기 후에도 유지한다.
//
// 신원(모두 되돌릴 수 없는 해시, 원문 저장 안 함)
//   key  : 회원 uid 해시 — 회원 구분(차단·신고), 모두에게 보여도 uid는 알 수 없음
//   gkey : 기기 표식 해시 — 손님 구분(신고용)
//   ip/dev : IP·기기 해시 — 입장 금지에만 쓰고 다른 사람에게는 절대 보내지 않음
//   tid  : 신고·차단 대상 ID = 'k:'+key(회원) 또는 'g:'+gkey(손님)
import { nickProblem, hasBadWord, isReservedNick } from '../../public/plaza/badwords.js';
import { sanitizeLook, isLockedAcc } from '../../public/plaza/look.js';
import { findSpot, setOfSpot } from '../../public/plaza/keys.js';
import { shortHash } from './hash.js';
import { verifyFirebaseIdToken } from './firebaseToken.js';

// 도배 방지: 연결마다 종류별 초당 허용량(토큰 버킷). 넘치면 조용히 버린다.
const RATE = { pos: [15, 20], emote: [0.5, 3], say: [0.35, 3], key: [1, 8], chat: [2, 6], req: [0.5, 3], accept: [1, 5], acceptwait: [1, 5], chatbye: [1, 5], photo: [1, 6], report: [0.2, 3], hello: [0.5, 3] };
const buckets = new WeakMap(); // ws → { type: { t, at } } (재우면 초기화돼도 무방)
function allow(ws, type) {
  const [rate, burst] = RATE[type] || [5, 10];
  let b = buckets.get(ws); if (!b) { b = {}; buckets.set(ws, b); }
  const now = Date.now() / 1000, cur = b[type] || { t: burst, at: now };
  cur.t = Math.min(burst, cur.t + (now - cur.at) * rate); cur.at = now;
  if (cur.t < 1) { b[type] = cur; return false; }
  cur.t -= 1; b[type] = cur; return true;
}

const AUTO_BAN_REPORTERS = 5;             // 서로 다른 회원 5명이
const AUTO_BAN_WINDOW_MS = 10 * 60 * 1000; // 10분 안에 신고하면
const AUTO_BAN_HOURS = 24;                // 24시간 입장 금지

// 자리 비움(💤): 나간 사람 캐릭터를 2시간 동안 제자리에 남긴다(회원·비회원 모두).
// 접속자 수·방 인원 제한·방문 통계에는 안 센다. 같은 사람(같은 회원 또는 같은 기기)이 다시 들어오면 바로 지운다.
const AWAY_MS = 2 * 60 * 60 * 1000;
const AWAY_MAX = 20;                      // 한 방에 남길 수 있는 최대 수(넘치면 오래된 것부터 지움)
const NO_AWAY_CODES = [4000, 4003, 4004]; // 방 꽉 참·입장 금지·같은 계정 중복 접속으로 끊긴 건 남기지 않음

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
  // 방 인원은 '+1/-1' 대신 실제 연결 수를 그대로 보고한다.
  // (배포·재시작으로 연결이 강제로 끊기면 퇴장 신호가 안 와서, 더하기·빼기 방식은 인원이 계속 부풀었다)
  live(except) {
    let n = 0; const vids = [];
    for (const ws of this.state.getWebSockets()) { if (ws === except) continue; const a = this.attach(ws); if (a && !a.gone && !a.test) { n++; if (a.vid) vids.push(a.vid); } }
    return { n, vids };
  }
  async reportCount(room, except) {
    const { n, vids } = this.live(except);
    // vids: 지금 실제로 있는 사람들의 접속 기록 번호 → 목록에 없는 '접속 중' 기록은 퇴장 처리(강제 종료 대비)
    try { await this.reg('/inc?room=' + encodeURIComponent(room) + '&set=' + n, { vids }); } catch (e) {}
    // 접속자가 있는 동안 1분마다 다시 보고(하트비트). 보고가 끊긴 방은 레지스트리가 3분 뒤 0명으로 본다.
    // 자리 비움 캐릭터가 남아 있으면 가장 먼저 끝나는 시각에도 깨어나 지운다.
    try { await this.schedule(n); } catch (e) {}
  }
  async schedule(n) {
    const away = await this.awayList();
    let at = n > 0 ? Date.now() + 60000 : Infinity;
    for (const g of away) at = Math.min(at, g.at + AWAY_MS + 1000);
    if (at === Infinity) return;
    const cur = await this.state.storage.getAlarm();
    if (!cur || cur > at) await this.state.storage.setAlarm(at);
  }
  async alarm() {
    await this.pruneAway();
    const ws = this.state.getWebSockets()[0];
    const room = (ws && this.attach(ws)?.room) || (await this.state.storage.get('room')) || 'plaza';
    await this.reportCount(room);
  }

  // ── 자리 비움 목록 (DO 저장소 'away': [{ id, nick, look, st, key, gkey, badges, tid, ip, dev, at }]) ──
  // ip·dev·tid는 신고·차단용으로만 저장하고 다른 사람에게는 보내지 않는다.
  async awayList() { return (await this.state.storage.get('away')) || []; }
  awayPeer(g) { return { id: g.id, nick: g.nick, look: g.look, state: g.st, key: g.key || null, gkey: g.gkey || null, admin: false, badges: g.badges || null, away: g.at }; }
  async removeAway(pred) {
    const away = await this.awayList();
    const keep = [], gone = [];
    for (const g of away) (pred(g) ? gone : keep).push(g);
    if (!gone.length) return 0;
    await this.state.storage.put('away', keep);
    for (const g of gone) this.broadcast(null, { t: 'leave', id: g.id });
    return gone.length;
  }
  async pruneAway() { const now = Date.now(); return this.removeAway((g) => now - g.at >= AWAY_MS); }

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
    if (url.pathname === '/announce') {
      const b = await request.json().catch(() => ({}));
      const m = b.msg || {};
      if (m.t === 'feed') this.broadcast(null, { t: 'feed', key: String(m.key || ''), nick: String(m.nick || '').slice(0, 12), aid: m.aid ? String(m.aid).slice(0, 16) : null });
      else if (m.t === 'wish') this.broadcast(null, { t: 'wish', key: String(m.key || ''), nick: String(m.nick || '').slice(0, 12), text: String(m.text || '').slice(0, 40), id: m.id ? String(m.id).slice(0, 40) : null, orn: m.orn ? String(m.orn).slice(0, 10) : null, theme: m.theme ? String(m.theme).slice(0, 16) : null,
        ...(Number.isFinite(+m.pa) && Number.isFinite(+m.py) ? { pa: +m.pa, py: +m.py } : {}) });   // 트리에서 고른 걸 자리
      // 관리자가 테마를 바꿈 → 각자 새 테마를 다시 불러온다
      else if (m.t === 'theme') this.broadcast(null, { t: 'theme' });
      // 관리자가 트리에 걸린 소원을 내림 → 모두의 화면에서 그 장식을 뗀다
      else if (m.t === 'wishhide') this.broadcast(null, { t: 'wishhide', id: String(m.id || '').slice(0, 40) });
      return Response.json({ ok: true });
    }
    if (url.pathname === '/kick') {
      const tid = url.searchParams.get('tid');
      const until = +url.searchParams.get('until') || 0;
      let n = 0;
      for (const ws of this.state.getWebSockets()) {
        const a = this.attach(ws);
        if (a && a.tid === tid) { this.kickBanned(ws, until, 'admin'); n++; }
      }
      n += await this.removeAway((g) => g.tid === tid);   // 자리 비움으로 남은 캐릭터도 지운다
      return Response.json({ kicked: n });
    }

    const room = this.clean(url.searchParams.get('room') || 'plaza', 24);
    const cap = +url.searchParams.get('cap') || 30;
    const ip = this.clean(url.searchParams.get('ip'), 16);
    const dev = this.clean(url.searchParams.get('dev'), 16);
    const test = url.searchParams.get('test') === '1';   // 운영 점검용 테스트 접속(워커가 비밀 키로 확인) → 기록·통계 제외

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
    this.save(server, { id, room, ip, dev, test, nick: null, look: null, st: { x: 0, z: 11, ry: 0 } });
    try { await this.state.storage.put('room', room); } catch (e) {}
    await this.reportCount(room);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    let m;
    try { m = JSON.parse(message); } catch (e) { return; }
    if (typeof message === 'string' && message.length > 8000) return; // 비정상적으로 큰 메시지 무시
    const a = this.attach(ws);
    if (!a) return;
    if (!m || typeof m.t !== 'string' || !allow(ws, m.t)) return;

    if (m.t === 'hello') {
      a.nick = this.clean(m.nick || '손님', 12);
      if (nickProblem(a.nick)) a.nick = '손님'; // 비속어·자음만 닉네임 차단
      a.look = sanitizeLook(m.look); // 외모 정보만 허용값으로(다른 사람에게 그대로 전달되므로 출생연도·직업 등은 절대 통과시키지 않음)
      // 회원 uid는 클라이언트 주장을 믿지 않고, Firebase 로그인 토큰을 구글 공개키로 검증해서만 얻는다(위조 방지).
      a.uid = m.idToken ? await verifyFirebaseIdToken(m.idToken) : null;
      a.key = a.uid ? await shortHash('kl-plaza:', a.uid) : null;
      a.gkey = a.key ? null : await shortHash('kl-guest:', a.dev || a.id);
      a.tid = a.key ? 'k:' + a.key : 'g:' + a.gkey;
      // 관리자: 로그인 토큰으로 검증된 uid가 PLAZA_ADMIN_UIDS(wrangler.toml)에 있을 때만. 운영자 사칭 닉네임은 일반 이용자에게 허용 안 함
      a.admin = !!a.uid && String(this.env.PLAZA_ADMIN_UIDS || '').split(',').map((x) => x.trim()).includes(a.uid);
      if (!a.admin && isReservedNick(a.nick)) a.nick = '손님';
      // 같은 회원 계정이 이 방에 이미 있으면 먼저 들어온 창을 끊는다(나 자신과 1:1 대화하게 되는 중복 로그인 방지)
      if (a.uid) {
        for (const p of this.state.getWebSockets()) {
          if (p === ws) continue;
          const pa = this.attach(p);
          if (pa && pa.uid === a.uid) { this.send(p, { t: 'dup' }); try { p.close(4004, 'dup'); } catch (e) {} }
        }
      }
      // 잠금 꾸미기(열쇠 보상·상점)와 반려동물은 실제로 가진 사람만, 회원 인증 배지(재직·사진)는 회원만 — 웹 서버에 물어 확인(화면 조작 방지)
      a.badges = null;
      if (a.uid || a.look.acc.some(isLockedAcc) || a.look.pet) {
        let owned = { unlocks: [], pet: null };
        if (a.uid || a.dev) {   // 비회원은 기기 번호로 키링 월드 전용 지갑에서 산 꾸미기를 확인
          try {
            const site = this.env.PLAZA_SITE_URL || 'https://www.keylink.kr';
            const r = await fetch(site + '/api/plaza/internal/owned', { method: 'POST', headers: { 'content-type': 'application/json', 'x-plaza-secret': this.env.PLAZA_ADMIN_SECRET || '' }, body: JSON.stringify(a.uid ? { uid: a.uid } : { dev: a.dev }) });
            if (r.ok) owned = await r.json();
          } catch (e) {}
        }
        a.look.acc = a.look.acc.filter((x) => !isLockedAcc(x) || (owned.unlocks || []).includes(x));
        a.badges = owned.badges || null;
        if (a.look.pet && !(owned.pet && owned.pet.id === a.look.pet.id)) delete a.look.pet;
        else if (a.look.pet) a.look.pet.name = owned.pet.name;
      }

      // 입장 금지 확인 (IP·기기·회원 중 하나라도 걸리면)
      try {
        const r = await (await this.reg('/banned?ip=' + a.ip + '&dev=' + a.dev + '&key=' + (a.key || '') + '&member=' + (a.key ? '1' : '0'))).json();
        if (r.banned) { this.save(ws, a); this.kickBanned(ws, r.until, 'banned'); return; }
      } catch (e) {}
      // 같은 사람의 자리 비움 캐릭터가 있으면 지운다(같은 회원 계정, 또는 같은 기기 — 비회원으로 나갔다가 로그인해서 와도)
      try { await this.removeAway((g) => (a.key && g.key === a.key) || (a.dev && g.dev === a.dev)); } catch (e) {}
      try { await this.reg('/seen', { tid: a.tid, ip: a.ip, dev: a.dev, key: a.key, nick: a.nick }); } catch (e) {}
      // 접속 기록(관리자 '광장 현황'): 처음 인사면 새 기록, 로그인 후 다시 인사하면 같은 기록을 갱신
      // 관리자 접속은 남기지 않는다 — 손님으로 들어왔다가 관리자로 로그인하면 그 기록도 지운다
      if (a.admin && a.vid) { try { await this.reg('/admin/visits/delete', { ids: [a.vid] }); } catch (e) {} a.vid = null; }
      if (!a.test && !a.admin) try {
        const v = { room: a.room, tid: a.tid, nick: a.nick, member: a.key ? 1 : 0, uid: a.uid || null };
        if (a.vid) await this.reg('/visit/update', { id: a.vid, ...v });
        else a.vid = (await (await this.reg('/visit/start', v)).json()).id;
      } catch (e) {}

      this.save(ws, a);
      const peers = [];
      for (const p of this.state.getWebSockets()) {
        if (p === ws) continue;
        const pa = this.attach(p);
        if (pa && pa.nick && !pa.gone) peers.push({ id: pa.id, nick: pa.nick, look: pa.look, state: pa.st, key: pa.key || null, gkey: pa.gkey || null, admin: !!pa.admin, badges: pa.badges || null });
      }
      try { const now = Date.now(); for (const g of await this.awayList()) if (now - g.at < AWAY_MS) peers.push(this.awayPeer(g)); } catch (e) {}
      this.send(ws, { t: 'welcome', id: a.id, room: a.room, nick: a.nick, admin: !!a.admin, peers });
      this.broadcast(ws, { t: 'join', id: a.id, nick: a.nick, look: a.look, state: a.st, key: a.key || null, gkey: a.gkey || null, admin: !!a.admin, badges: a.badges || null });
    } else if (m.t === 'pos') {
      a.st = { x: +m.x || 0, z: +m.z || 0, y: Math.max(-1, Math.min(12, +m.y || 0)), ry: +m.ry || 0, p: m.p === 'sit' ? 'sit' : '' }; // p: 앉아 있음(새로 들어온 사람도 앉은 모습으로 보이게 저장)
      this.save(ws, a);
      this.broadcast(ws, { t: 'peer', id: a.id, x: a.st.x, z: a.st.z, y: a.st.y, ry: a.st.ry, p: a.st.p });
    } else if (m.t === 'emote') {
      // 이모트(인사·춤·하트): 정해진 것만 방 전체에
      if (a.nick && ['wave', 'dance', 'heart'].includes(m.e)) this.broadcast(ws, { t: 'emote', id: a.id, e: m.e });
    } else if (m.t === 'key') {
      // 황금 열쇠(크리스마스 테마는 선물 상자): 회원만 서버에 기록(보상용). 마지막으로 받은 내 위치가 그 자리 가까이일 때만 인정
      if (!a.uid) return;
      const k = findSpot(m.id);
      if (!k || !a.st) return;
      if (Math.hypot((a.st.x || 0) - k.x, (a.st.z || 0) - k.z) > 2.2 || Math.abs((a.st.y || 0) - k.y) > 1.8) return;
      const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      try {
        const set = setOfSpot(k.id);
        const r = await (await this.reg('/key', { day, uid: a.uid, id: k.id, ids: set.map((s) => s.id) })).json();
        this.send(ws, { t: 'keyok', id: k.id, n: r.n || 0, total: set.length });
      } catch (e) {}
    } else if (m.t === 'say') {
      // 머리 위 말풍선(광장 공개): 40자, 제어문자 제거, 비속어는 보내지 않고 본인에게만 알림
      if (!a.nick) return;
      const text = String(m.text ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
      if (!text) return;
      if (hasBadWord(text)) { this.send(ws, { t: 'saynope' }); return; }
      this.broadcast(ws, { t: 'say', id: a.id, text });
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
        return;
      }
      // 자리 비움 캐릭터 신고
      try {
        const g = (await this.awayList()).find((x) => x.id === to);
        if (g && g.tid !== a.tid) {
          const r = await (await this.reg('/report', {
            tid: g.tid, reporter: a.key, target: { ip: g.ip, dev: g.dev, key: g.key },
            threshold: AUTO_BAN_REPORTERS, windowMs: AUTO_BAN_WINDOW_MS, hours: AUTO_BAN_HOURS,
          })).json();
          if (r.ban) await this.removeAway((x) => x.tid === g.tid);
        }
      } catch (e) {}
    } else if (m.t === 'req' || m.t === 'accept' || m.t === 'acceptwait' || m.t === 'chat' || m.t === 'chatbye' || m.t === 'photo') {
      const to = this.clean(m.to, 12);
      for (const p of this.state.getWebSockets()) {
        const pa = this.attach(p);
        if (pa && pa.id === to) {
          // uid는 1:1 상대에게만 실어 보낸다(영속 DM 대화방 매칭용). 방 전체엔 노출 안 함.
          if (m.t === 'chat') this.send(p, { t: 'chat', from: a.id, nick: a.nick, uid: a.uid, key: a.key || null, text: this.clean(m.text, 1000) });
          else if (m.t === 'photo') this.send(p, { t: 'photo', from: a.id, nick: a.nick, uid: a.uid, key: a.key || null, ev: this.clean(m.ev, 10) }); // 사진 교환 상태가 바뀜(실제 상태는 서버 API가 판단)
          else this.send(p, { t: m.t, from: a.id, nick: a.nick, uid: a.uid, key: a.key || null }); // req / accept / acceptwait(비회원이 수락 — 가입 대기) / chatbye(대화방 나감)
          break;
        }
      }
    }
  }

  async webSocketClose(ws, code) { await this.onGone(ws, code); }
  async webSocketError(ws) { await this.onGone(ws, 0); }
  async onGone(ws, code) {
    const a = this.attach(ws);
    if (!a || a.gone) return;
    a.gone = true; this.save(ws, a);
    // 자리 비움으로 남길지: 인사를 마친 일반 이용자만(관리자·점검 접속 제외), 강제로 끊긴 경우 제외, 같은 사람이 다른 창으로 아직 있으면 제외
    let away = !!a.nick && !a.admin && !a.test && !!a.tid && !NO_AWAY_CODES.includes(code);
    if (away) for (const p of this.state.getWebSockets()) { if (p === ws) continue; const pa = this.attach(p); if (pa && !pa.gone && pa.tid === a.tid) { away = false; break; } }
    if (away) {
      try {
        const now = Date.now();
        const list = [];
        for (const g of await this.awayList()) { if (now - g.at < AWAY_MS && g.tid !== a.tid) list.push(g); else this.broadcast(ws, { t: 'leave', id: g.id }); }
        list.push({ id: a.id, nick: a.nick, look: a.look, st: a.st, key: a.key || null, gkey: a.gkey || null, badges: a.badges || null, tid: a.tid, ip: a.ip, dev: a.dev, at: now });
        while (list.length > AWAY_MAX) { const old = list.shift(); this.broadcast(ws, { t: 'leave', id: old.id }); }
        await this.state.storage.put('away', list);
        this.broadcast(ws, { t: 'away', id: a.id, at: now });
      } catch (e) { away = false; }
    }
    if (a.nick && !away) this.broadcast(ws, { t: 'leave', id: a.id });
    if (a.vid) { try { await this.reg('/visit/end', { id: a.vid }); } catch (e) {} }
    await this.reportCount(a.room, ws);
  }
}
