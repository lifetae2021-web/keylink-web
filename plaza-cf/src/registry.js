// 광장 전체를 관리하는 단일 Durable Object.
// - counts : 방별 인원 (입장/퇴장 시 /inc)
// - sess   : 최근 접속자 신원(해시) — 신고 대상 → 기기·IP 해시를 찾기 위해 7일 보관
// - reports: 실시간 신고 누적 — 서로 다른 회원 N명이 10분 안에 신고하면 자동 입장 금지
// - bans   : 입장 금지 목록 { 'ip:해시' | 'dev:해시' | 'key:해시': 해제시각(ms) }
// - SQLite visits : 접속 기록(입장·퇴장 시각, 닉네임, 회원 여부) 30일 보관 — 관리자 '광장 현황'
// - SQLite conc   : 5분 단위 동시접속(최고값·마지막 값) 90일 보관
const SESS_TTL = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const VISIT_TTL = 30 * DAY, CONC_TTL = 90 * DAY, BUCKET = 5 * 60 * 1000;
const KST = 9 * 60 * 60 * 1000;
const STALE = 12 * 60 * 60 * 1000;
const COUNT_STALE = 3 * 60 * 1000; // 방이 3분 넘게 인원 보고(1분 하트비트)를 안 하면 0명으로 본다 // 퇴장 기록 없이 12시간 지나면 '접속 중'으로 보지 않음(서버 재시작 등)
const FOREVER = 8640000000000000; // 영구 차단

export class PlazaRegistry {
  constructor(state) { this.state = state; }

  async get(k, d) { return (await this.state.storage.get(k)) || d; }
  sql() {
    const s = this.state.storage.sql;
    if (!this.sqlReady) {
      s.exec('CREATE TABLE IF NOT EXISTS visits(id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, tid TEXT, nick TEXT, member INTEGER, uid TEXT, enter_at INTEGER, leave_at INTEGER)');
      s.exec('CREATE INDEX IF NOT EXISTS visits_enter ON visits(enter_at)');
      s.exec('CREATE TABLE IF NOT EXISTS conc(bucket INTEGER PRIMARY KEY, peak INTEGER, last INTEGER)');
      s.exec('CREATE TABLE IF NOT EXISTS keyclaims(day TEXT, uid TEXT, kid TEXT, at INTEGER, PRIMARY KEY(day, uid, kid))');   // 황금 열쇠(회원, 한국 날짜)
      this.sqlReady = true;
    }
    return s;
  }
  rows(q, ...args) { return this.sql().exec(q, ...args).toArray(); }
  // 살아 있는 방 인원만 (보고가 끊긴 방은 제외)
  async liveCounts(now) {
    const c = await this.get('counts', {}), at = await this.get('countsAt', {});
    const out = {};
    for (const [room, n] of Object.entries(c)) if (n > 0 && now - (at[room] || 0) < COUNT_STALE) out[room] = n;
    return out;
  }
  cleanupOld(now) { // 가끔(약 2%) 오래된 기록 정리
    if (Math.random() > 0.02) return;
    this.sql().exec('DELETE FROM visits WHERE enter_at < ?', now - VISIT_TTL);
    this.sql().exec('DELETE FROM conc WHERE bucket < ?', Math.floor((now - CONC_TTL) / BUCKET));
    this.sql().exec('DELETE FROM keyclaims WHERE at < ?', now - 40 * DAY);
  }
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
      const c = await this.get('counts', {}), at = await this.get('countsAt', {});
      c[room] = url.searchParams.has('set') ? Math.max(0, +q('set') || 0) : Math.max(0, (c[room] || 0) + (+q('delta') || 0));
      at[room] = now;
      if (c[room] === 0) { delete c[room]; delete at[room]; }
      await this.state.storage.put({ counts: c, countsAt: at });
      // 이 방에 실제로 없는데 '접속 중'으로 남은 기록은 퇴장 처리(배포·재시작으로 퇴장 신호가 안 온 경우)
      if (request.method === 'POST') {
        const vids = ((await request.json().catch(() => ({}))).vids || []).map((v) => +v).filter((v) => v > 0).slice(0, 500);
        this.sql().exec('UPDATE visits SET leave_at = ? WHERE room = ? AND leave_at IS NULL AND enter_at < ?' + (vids.length ? ' AND id NOT IN (' + vids.map(() => '?').join(',') + ')' : ''),
          now, room, now - 10000, ...vids);
      }
      const live = await this.liveCounts(now);
      // 동시접속 기록: 5분 칸마다 최고값과 마지막 값
      const total = Object.values(live).reduce((s, n) => s + n, 0);
      this.sql().exec('INSERT INTO conc(bucket, peak, last) VALUES(?, ?, ?) ON CONFLICT(bucket) DO UPDATE SET peak = max(peak, excluded.peak), last = excluded.last',
        Math.floor(now / BUCKET), total, total);
      return new Response('ok');
    }

    if (url.pathname === '/list') {
      const c = await this.liveCounts(now);
      return Response.json({ rooms: Object.entries(c).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)) });
    }

    if (url.pathname === '/place') {
      const cap = +q('cap') || 30;
      const prefix = q('prefix').replace(/[^a-z]/g, '') || 'region';
      const c = await this.liveCounts(now);
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

    // 접속 기록: 입장(닉네임 확정 시) / 정보 갱신(로그인 후 재인사) / 퇴장
    if (url.pathname === '/visit/start') {
      const b = await request.json();
      const r = this.rows('INSERT INTO visits(room, tid, nick, member, uid, enter_at) VALUES(?, ?, ?, ?, ?, ?) RETURNING id',
        String(b.room || ''), String(b.tid || ''), String(b.nick || ''), b.member ? 1 : 0, b.uid || null, now);
      this.cleanupOld(now);
      return Response.json({ id: r[0]?.id ?? null });
    }
    if (url.pathname === '/visit/update') {
      const b = await request.json();
      this.sql().exec('UPDATE visits SET tid = ?, nick = ?, member = ?, uid = ? WHERE id = ?',
        String(b.tid || ''), String(b.nick || ''), b.member ? 1 : 0, b.uid || null, +b.id || 0);
      return new Response('ok');
    }
    if (url.pathname === '/visit/end') {
      const b = await request.json();
      this.sql().exec('UPDATE visits SET leave_at = ? WHERE id = ? AND leave_at IS NULL', now, +b.id || 0);
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
    // 황금 열쇠 기록(방에서 위치 확인 후 호출) / 오늘 몇 개 모았는지(Next 서버가 보상 줄 때 확인)
    if (url.pathname === '/key') {
      const b = await request.json();
      this.sql().exec('INSERT OR IGNORE INTO keyclaims(day, uid, kid, at) VALUES (?, ?, ?, ?)', String(b.day), String(b.uid), String(b.id), now);
      this.cleanupOld(now);
      return Response.json({ n: this.rows('SELECT COUNT(*) AS n FROM keyclaims WHERE day = ? AND uid = ?', String(b.day), String(b.uid))[0].n });
    }
    // 관리자: 접속 기록 지우기(운영 점검용 테스트 접속 정리) — 번호(id)로만
    if (url.pathname === '/admin/visits/delete') {
      const b = await request.json();
      const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => +x).filter((x) => Number.isInteger(x) && x > 0).slice(0, 200);
      let n = 0;
      for (const id of ids) { this.sql().exec('DELETE FROM visits WHERE id = ?', id); n++; }
      return Response.json({ ok: true, deleted: n });
    }
    if (url.pathname === '/admin/keys') {
      const b = await request.json();
      const ids = this.rows('SELECT kid FROM keyclaims WHERE day = ? AND uid = ?', String(b.day), String(b.uid)).map((r) => r.kid);
      return Response.json({ n: ids.length, ids });
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

    // 관리자: 광장 현황(지금 접속·동시접속 추이·일별 요약·접속 기록)
    if (url.pathname === '/admin/stats') {
      const b = await request.json().catch(() => ({}));
      const counts = await this.liveCounts(now);
      const nowTotal = Object.values(counts).reduce((s, n) => s + n, 0);
      const dayStart = (t) => Math.floor((t + KST) / DAY) * DAY - KST; // 한국 날짜 기준 0시
      const today = dayStart(now);

      // 최근 24시간: 1시간 칸마다 최고 동시접속(기록 없는 칸은 직전 인원 유지)
      const from = Math.floor((now - DAY) / BUCKET);
      const before = this.rows('SELECT last FROM conc WHERE bucket < ? ORDER BY bucket DESC LIMIT 1', from)[0];
      const byBucket = new Map(this.rows('SELECT bucket, peak, last FROM conc WHERE bucket >= ?', from).map((r) => [r.bucket, r]));
      let carry = before ? before.last : 0;
      const hourly = [];
      const hourStart = Math.floor(now / 3600000) * 3600000 - 23 * 3600000;
      for (let h = 0; h < 24; h++) {
        const hs = hourStart + h * 3600000;
        let peak = 0, seen = false;
        for (let k = Math.floor(hs / BUCKET); k < Math.floor((hs + 3600000) / BUCKET); k++) {
          if (k * BUCKET > now) break;
          const r = byBucket.get(k);
          const v = r ? r.peak : carry;
          if (r) carry = r.last;
          peak = Math.max(peak, v); seen = true;
        }
        hourly.push({ t: hs, peak: seen ? peak : 0 });
      }

      // 일별 요약(최근 14일)
      const d14 = today - 13 * DAY;
      const peaks = new Map(this.rows('SELECT CAST((bucket * ? + ?) / ? AS INTEGER) AS d, MAX(peak) AS p FROM conc WHERE bucket >= ? GROUP BY d', BUCKET, KST, DAY, Math.floor(d14 / BUCKET)).map((r) => [r.d, r.p]));
      const vis = new Map(this.rows(
        'SELECT CAST((enter_at + ?) / ? AS INTEGER) AS d, COUNT(*) AS entries, COUNT(DISTINCT tid) AS uniq, COUNT(DISTINCT CASE WHEN member = 1 THEN tid END) AS members, ' +
        'AVG(CASE WHEN leave_at IS NOT NULL AND leave_at - enter_at < ? THEN leave_at - enter_at END) AS avgStay FROM visits WHERE enter_at >= ? GROUP BY d',
        KST, DAY, STALE, d14).map((r) => [r.d, r]));
      const daily = [];
      for (let i = 0; i < 14; i++) {
        const ds = today - i * DAY, key = Math.floor((ds + KST) / DAY), v = vis.get(key) || {};
        daily.push({ day: ds, peak: peaks.get(key) || 0, entries: v.entries || 0, uniq: v.uniq || 0, members: v.members || 0, avgStayMs: v.avgStay ? Math.round(v.avgStay) : 0 });
      }
      const best = this.rows('SELECT bucket, peak FROM conc ORDER BY peak DESC, bucket DESC LIMIT 1')[0];

      // 접속 기록(최신순) — 구분·닉네임 검색
      const type = b.type === 'member' ? 1 : b.type === 'guest' ? 0 : null;
      const qn = String(b.q || '').slice(0, 20);
      const limit = Math.min(Math.max(+b.limit || 200, 1), 500);
      const where = ['enter_at >= ?'], args = [now - VISIT_TTL];
      if (type !== null) { where.push('member = ?'); args.push(type); }
      if (qn) { where.push('nick LIKE ?'); args.push('%' + qn + '%'); }
      const visits = this.rows('SELECT id, room, nick, member, uid, tid, enter_at, leave_at FROM visits WHERE ' + where.join(' AND ') + ' ORDER BY enter_at DESC LIMIT ?', ...args, limit)
        .map((r) => ({ ...r, online: r.leave_at == null && now - r.enter_at < STALE }));

      return Response.json({
        now: { total: nowTotal, rooms: counts },
        todayPeak: daily[0].peak,
        best: best ? { peak: best.peak, at: best.bucket * BUCKET } : null,
        hourly, daily, visits, retentionDays: VISIT_TTL / DAY,
      });
    }

    return new Response('registry');
  }
}
