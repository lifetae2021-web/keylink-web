// 광장 전체를 관리하는 단일 Durable Object.
// - counts : 방별 인원 (입장/퇴장 시 /inc)
// - sess   : 최근 접속자 신원(해시) — 신고 대상 → 기기·IP 해시를 찾기 위해 7일 보관
// - reports: 실시간 신고 누적 — 서로 다른 회원 N명이 10분 안에 신고하면 자동 입장 금지
// - bans   : 입장 금지 목록 { 'ip:해시' | 'dev:해시' | 'key:해시': 해제시각(ms) }
const SESS_TTL = 7 * 24 * 60 * 60 * 1000;
const FOREVER = 8640000000000000; // 영구 차단

export class PlazaRegistry {
  constructor(state) { this.state = state; }

  async get(k, d) { return (await this.state.storage.get(k)) || d; }
  roomName(prefix, i) { return prefix + '-' + String(i).padStart(2, '0'); }

  identsOf(s) { // 차단에 쓸 식별자들
    const out = [];
    if (s?.ip) out.push('ip:' + s.ip);
    if (s?.dev) out.push('dev:' + s.dev);
    if (s?.key) out.push('key:' + s.key);
    return out;
  }
  async banIdents(idents, until) {
    const bans = await this.get('bans', {});
    for (const id of idents) bans[id] = until;
    await this.state.storage.put('bans', bans);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const q = (k) => url.searchParams.get(k) || '';
    const now = Date.now();

    if (url.pathname === '/inc') {
      const room = q('room');
      const c = await this.get('counts', {});
      c[room] = Math.max(0, (c[room] || 0) + (+q('delta') || 0));
      if (c[room] === 0) delete c[room];
      await this.state.storage.put('counts', c);
      return new Response('ok');
    }

    if (url.pathname === '/list') {
      const c = await this.get('counts', {});
      return Response.json({ rooms: Object.entries(c).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)) });
    }

    if (url.pathname === '/place') {
      const cap = +q('cap') || 30;
      const prefix = q('prefix').replace(/[^a-z]/g, '') || 'region';
      const c = await this.get('counts', {});
      let best = null, bestN = -1;
      for (const [name, n] of Object.entries(c)) {
        if (!name.startsWith(prefix + '-')) continue; // 같은 지역 채널끼리만
        if (n < cap && n > bestN) { best = name; bestN = n; } // 빈 자리 중 사람 많은 곳
      }
      if (!best) { let i = 1; while (c[this.roomName(prefix, i)] !== undefined) i++; best = this.roomName(prefix, i); }
      return Response.json({ room: best });
    }

    // 입장 금지 여부 (ip/dev/key 중 하나라도 걸리면 금지)
    // 회원(member=1)은 IP로는 막지 않는다 — 통신사·와이파이는 여러 사람이 같은 IP를 쓰므로 무고한 회원이 막히지 않게.
    // (회원은 자기 계정·기기로 판단, IP 차단은 손님에게만 적용)
    if (url.pathname === '/banned') {
      const bans = await this.get('bans', {});
      let until = 0;
      for (const id of this.identsOf({ ip: q('member') === '1' ? '' : q('ip'), dev: q('dev'), key: q('key') })) {
        if (bans[id] && bans[id] > now) until = Math.max(until, bans[id]);
      }
      return Response.json({ banned: until > now, until });
    }

    // 접속자 신원 기록 (신고·관리자 차단 시 기기·IP 해시를 찾기 위해)
    if (url.pathname === '/seen') {
      const b = await request.json();
      const sess = await this.get('sess', {});
      sess[b.tid] = { ip: b.ip || '', dev: b.dev || '', key: b.key || '', nick: b.nick || '', at: now };
      for (const [k, v] of Object.entries(sess)) if (now - v.at > SESS_TTL) delete sess[k];
      await this.state.storage.put('sess', sess);
      return new Response('ok');
    }

    // 실시간 신고 누적 → 임계값 넘으면 자동 입장 금지
    if (url.pathname === '/report') {
      const b = await request.json();
      const windowMs = b.windowMs || 10 * 60 * 1000, threshold = b.threshold || 5;
      const reports = await this.get('reports', {});
      const list = (reports[b.tid] || []).filter((r) => now - r.at < windowMs && r.reporter !== b.reporter);
      list.push({ reporter: b.reporter, at: now });
      const distinct = new Set(list.map((r) => r.reporter)).size;
      if (distinct >= threshold) {
        const sess = await this.get('sess', {});
        const until = now + (b.hours || 24) * 60 * 60 * 1000;
        await this.banIdents(this.identsOf(sess[b.tid] || b.target), until);
        delete reports[b.tid];
        await this.state.storage.put('reports', reports);
        return Response.json({ ban: true, until, count: distinct });
      }
      reports[b.tid] = list;
      for (const [k, v] of Object.entries(reports)) if (!v.some((r) => now - r.at < windowMs)) delete reports[k];
      await this.state.storage.put('reports', reports);
      return Response.json({ ban: false, count: distinct });
    }

    // 관리자: 입장 금지 / 해제 / 목록
    if (url.pathname === '/admin/ban') {
      const b = await request.json();
      const sess = await this.get('sess', {});
      const s = sess[b.tid];
      if (!s) return Response.json({ ok: false, error: 'unknown_target' }, { status: 404 });
      const until = b.hours > 0 ? now + b.hours * 60 * 60 * 1000 : FOREVER;
      const idents = this.identsOf(s);
      await this.banIdents(idents, until);
      return Response.json({ ok: true, until, idents: idents.map((x) => x.split(':')[0]) });
    }
    if (url.pathname === '/admin/unban') {
      const b = await request.json();
      const sess = await this.get('sess', {});
      const bans = await this.get('bans', {});
      for (const id of this.identsOf(sess[b.tid])) delete bans[id];
      await this.state.storage.put('bans', bans);
      return Response.json({ ok: true });
    }
    if (url.pathname === '/admin/status') {
      const b = await request.json();
      const sess = await this.get('sess', {});
      const bans = await this.get('bans', {});
      const out = {};
      for (const tid of b.tids || []) {
        let until = 0;
        for (const id of this.identsOf(sess[tid])) if (bans[id] > now) until = Math.max(until, bans[id]);
        out[tid] = { known: !!sess[tid], bannedUntil: until > now ? until : 0 };
      }
      return Response.json({ status: out });
    }

    return new Response('registry');
  }
}
