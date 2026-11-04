// 접속자 집계 + 방 배치를 담당하는 단일 Durable Object.
// 방(PlazaRoom)이 입장/퇴장할 때 /inc 로 인원을 올리고 내린다.
export class PlazaRegistry {
  constructor(state) { this.state = state; }

  async counts() { return (await this.state.storage.get('counts')) || {}; }

  roomName(prefix, i) { return prefix + '-' + String(i).padStart(2, '0'); }

  async fetch(request) {
    const url = new URL(request.url);
    const cap = +url.searchParams.get('cap') || 30;

    if (url.pathname === '/inc') {
      const room = url.searchParams.get('room');
      const delta = +url.searchParams.get('delta') || 0;
      const c = await this.counts();
      c[room] = Math.max(0, (c[room] || 0) + delta);
      if (c[room] === 0) delete c[room];
      await this.state.storage.put('counts', c);
      return new Response('ok');
    }

    if (url.pathname === '/list') {
      const c = await this.counts();
      const rooms = Object.entries(c)
        .map(([name, count]) => ({ name, count, cap }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return Response.json({ rooms, cap });
    }

    if (url.pathname === '/place') {
      const prefix = (url.searchParams.get('prefix') || 'region').replace(/[^a-z]/g, '');
      const c = await this.counts();
      // 빈 자리 있는 방 중 '사람이 가장 많은' 방으로 (혼자 외롭지 않게 모아줌)
      let best = null, bestN = -1;
      for (const [name, n] of Object.entries(c)) {
        if (!name.startsWith(prefix + '-')) continue; // 같은 지역 채널끼리만
        if (n < cap && n > bestN) { best = name; bestN = n; }
      }
      // 전부 꽉 찼거나 방이 없으면: 안 쓰는 가장 작은 번호로 새 방
      if (!best) {
        let i = 1;
        while (c[this.roomName(prefix, i)] !== undefined) i++;
        best = this.roomName(prefix, i);
      }
      return Response.json({ room: best });
    }

    return new Response('registry');
  }
}
