// 광장의 방 하나 = PlazaRoom DO 하나.
// WebSocket Hibernation API를 써서, 소켓이 조용할 때 메모리에서 재워 과금을 아낀다.
// 접속자별 메타데이터(닉/룩/위치)는 소켓 attachment에 저장해 재우기/깨우기 후에도 유지한다.
export class PlazaRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  registry() {
    return this.env.PLAZA_REGISTRY.get(this.env.PLAZA_REGISTRY.idFromName('registry'));
  }
  async bumpRegistry(room, delta) {
    try { await this.registry().fetch('https://do/inc?room=' + encodeURIComponent(room) + '&delta=' + delta); } catch (e) {}
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

  async fetch(request) {
    const url = new URL(request.url);
    const room = this.clean(url.searchParams.get('room') || 'plaza', 24);
    const cap = +url.searchParams.get('cap') || 30;

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    // 방이 꽉 찼으면 거절 (워커가 이미 빈 방을 골라주지만, 동시 접속 레이스 방어)
    if (this.state.getWebSockets().length >= cap) {
      return new Response('room full', { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    const id = 'u' + Math.random().toString(36).slice(2, 8);

    this.state.acceptWebSocket(server);
    this.save(server, { id, room, nick: null, look: null, st: { x: 0, z: 11, ry: 0 } });
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
      a.look = (m.look && typeof m.look === 'object') ? m.look : {};
      a.uid = m.uid ? this.clean(m.uid, 128) : null; // 회원 uid(영속 DM 대화방 키용). 1:1 상대에게만 전달, 브로드캐스트 안 함.
      this.save(ws, a);
      // 나에게는 기존 접속자 목록, 남들에게는 내 입장 알림
      const peers = [];
      for (const p of this.state.getWebSockets()) {
        if (p === ws) continue;
        const pa = this.attach(p);
        if (pa) peers.push({ id: pa.id, nick: pa.nick, look: pa.look, state: pa.st });
      }
      this.send(ws, { t: 'welcome', id: a.id, room: a.room, peers });
      this.broadcast(ws, { t: 'join', id: a.id, nick: a.nick, look: a.look, state: a.st });
    } else if (m.t === 'pos') {
      a.st = { x: +m.x || 0, z: +m.z || 0, ry: +m.ry || 0 };
      this.save(ws, a);
      this.broadcast(ws, { t: 'peer', id: a.id, x: a.st.x, z: a.st.z, ry: a.st.ry });
    } else if (m.t === 'req' || m.t === 'accept' || m.t === 'chat') {
      const to = this.clean(m.to, 12);
      for (const p of this.state.getWebSockets()) {
        const pa = this.attach(p);
        if (pa && pa.id === to) {
          // uid는 1:1 상대에게만 실어 보낸다(영속 DM 대화방 매칭용). 방 전체엔 노출 안 함.
          if (m.t === 'chat') this.send(p, { t: 'chat', from: a.id, nick: a.nick, uid: a.uid, text: this.clean(m.text, 1000) });
          else this.send(p, { t: m.t, from: a.id, nick: a.nick, uid: a.uid });
          break;
        }
      }
    }
  }

  async webSocketClose(ws) { await this.onGone(ws); }
  async webSocketError(ws) { await this.onGone(ws); }
  async onGone(ws) {
    const a = this.attach(ws);
    if (!a) return;
    this.broadcast(ws, { t: 'leave', id: a.id });
    await this.bumpRegistry(a.room, -1);
  }
}
