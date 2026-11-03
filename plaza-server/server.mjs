// 키링크 광장 실시간 서버 (WebSocket) — 방(room)별로 접속자 위치를 주고받는다.
// 로컬: `npm i && npm start` (기본 ws://localhost:8787)
// 배포: GCP 서울 VM 등에서 그대로 실행, 앞단에 wss(TLS) 붙이기.
import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8787;
const server = http.createServer((req, res) => { res.writeHead(200); res.end('keylink plaza ws'); });
const wss = new WebSocketServer({ server });

const rooms = new Map(); // roomName -> Map(id -> ws)
const roomOf = (name) => { if (!rooms.has(name)) rooms.set(name, new Map()); return rooms.get(name); };
const clean = (s, n) => String(s ?? '').slice(0, n);
let nextId = 1;

function broadcast(r, exceptId, msg) {
  const s = JSON.stringify(msg);
  for (const [pid, pws] of r) if (pid !== exceptId && pws.readyState === 1) pws.send(s);
}

wss.on('connection', (ws) => {
  const id = 'u' + (nextId++);
  ws._id = id; ws._room = null; ws._state = { x: 0, z: 11, ry: 0 };

  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf); } catch { return; }

    if (m.t === 'hello') {
      ws._room = clean(m.room || 'plaza', 24);
      ws._nick = clean(m.nick || '손님', 12);
      ws._look = (m.look && typeof m.look === 'object') ? m.look : {};
      const r = roomOf(ws._room);
      const peers = [];
      for (const [pid, pws] of r) peers.push({ id: pid, nick: pws._nick, look: pws._look, state: pws._state });
      ws.send(JSON.stringify({ t: 'welcome', id, peers }));
      r.set(id, ws);
      broadcast(r, id, { t: 'join', id, nick: ws._nick, look: ws._look, state: ws._state });
    } else if (m.t === 'pos' && ws._room) {
      ws._state = { x: +m.x || 0, z: +m.z || 0, ry: +m.ry || 0 };
      broadcast(rooms.get(ws._room), id, { t: 'peer', id, x: ws._state.x, z: ws._state.z, ry: ws._state.ry });
    } else if (m.t === 'req' && ws._room) {           // 1:1 대화 신청 중계
      const target = rooms.get(ws._room)?.get(clean(m.to, 12));
      if (target && target.readyState === 1) target.send(JSON.stringify({ t: 'req', from: id, nick: ws._nick }));
    } else if (m.t === 'accept' && ws._room) {        // 수락 중계
      const target = rooms.get(ws._room)?.get(clean(m.to, 12));
      if (target && target.readyState === 1) target.send(JSON.stringify({ t: 'accept', from: id, nick: ws._nick }));
    } else if (m.t === 'chat' && ws._room) {          // 1:1 대화 메시지 중계
      const target = rooms.get(ws._room)?.get(clean(m.to, 12));
      if (target && target.readyState === 1) target.send(JSON.stringify({ t: 'chat', from: id, nick: ws._nick, text: clean(m.text, 300) }));
    }
  });

  ws.on('close', () => {
    if (!ws._room) return;
    const r = rooms.get(ws._room);
    if (r) { r.delete(id); broadcast(r, id, { t: 'leave', id }); if (r.size === 0) rooms.delete(ws._room); }
  });
});

server.listen(PORT, () => console.log('[plaza] WebSocket 서버 실행: ws://localhost:' + PORT));
