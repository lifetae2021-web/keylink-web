# 키링 월드 캐릭터 부위(헤어·의상·신발·액세서리) — build_avatar.py 다음에 exec로 실행. 설계: avatar_spec.md
# 의상: 몸 메시에서 면을 골라 복제 → 법선 방향으로 부풀림(셰이프 키·가중치 그대로 따라감)
# 헤어·모자·안경: head 뼈에 고정 / 치마·가방끈: 가까운 몸 정점의 가중치·셰이프 키를 옮겨 받음
import bpy, bmesh, math
from mathutils import Vector, kdtree

def tint(name, rgb, rough=0.8):
    """웹에서 색을 바꾸는 재질은 TINT_, 고정 재질은 FIX_로 시작."""
    m = mat(name, rgb, rough)
    m.use_backface_culling = False
    return m

def bone_param(arm, body):
    """정점마다 (주 뼈 이름, 뼈 위 위치 0~1)."""
    out = []
    for v in body.data.vertices:
        if not v.groups: out.append((None, 0)); continue
        g = max(v.groups, key=lambda x: x.weight); bn = body.vertex_groups[g.group].name; b = arm.data.bones[bn]
        h, t = b.head_local, b.tail_local; d = t - h
        out.append((bn, max(0.0, min(1.0, (v.co - h).dot(d) / d.length_squared))))
    return out

def garment_from_body(name, body, arm, coll, keep_face, offset, material, cuts=()):
    """몸 메시 복제 → cuts(점, 법선) 평면으로 깔끔하게 자른 뒤 keep_face(중심, 주 뼈, 뼈 위 위치)인 면만 남기고 부풀린다.
    잘린 자리의 새 정점도 가중치·셰이프 키가 보간되어 몸을 따라간다."""
    drop(name)
    me = body.data.copy(); me.name = name
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.parent = arm
    md = o.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    bm = bmesh.new(); bm.from_mesh(me)
    for co, no in cuts:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=0.0005)
    dl = bm.verts.layers.deform.active; names = {g.index: g.name for g in body.vertex_groups}
    def dom(v):
        d = v[dl] if dl else {}
        return names[max(d.items(), key=lambda x: x[1])[0]] if d else None
    def tpos(bn, co):
        if not bn: return 0.0
        b = arm.data.bones[bn]; h, t = b.head_local, b.tail_local; d = t - h
        return max(0.0, min(1.0, (co - h).dot(d) / d.length_squared))
    bad = []
    for f in bm.faces:
        c = f.calc_center_median(); bones = [dom(v) for v in f.verts]; bn = max(set(bones), key=bones.count)
        if not keep_face(c, bn, tpos(bn, c)): bad.append(f)
    bmesh.ops.delete(bm, geom=bad, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update(); layers = list(bm.verts.layers.shape.values())
    for v in bm.verts:
        d = v.normal * offset
        for L in layers: v[L] = v[L] + d
        v.co = v.co + d
    bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    return o

def bone_cut(arm, bn, t):
    b = arm.data.bones[bn]; h, tl = b.head_local, b.tail_local
    return (h + (tl - h) * t, (tl - h).normalized())

def transfer_from_body(o, body, arm, keys=True):
    """o의 각 정점에 가장 가까운 몸 정점의 가중치(그리고 셰이프 키 변화량)를 복사."""
    bme = body.data; kd = kdtree.KDTree(len(bme.vertices))
    for v in bme.vertices: kd.insert(v.co, v.index)
    kd.balance()
    o.parent = arm
    if not any(m.type == 'ARMATURE' for m in o.modifiers):
        md = o.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    o.vertex_groups.clear()
    for vg in body.vertex_groups: o.vertex_groups.new(name=vg.name)
    near = []
    for v in o.data.vertices:
        co, idx, dist = kd.find(v.co); near.append(idx)
        for g in bme.vertices[idx].groups:
            o.vertex_groups[body.vertex_groups[g.group].name].add([v.index], g.weight, 'REPLACE')
    if keys and bme.shape_keys:
        if not o.data.shape_keys: o.shape_key_add(name='Basis')
        base = bme.shape_keys.key_blocks['Basis']
        for kb in bme.shape_keys.key_blocks[1:]:
            k = o.data.shape_keys.key_blocks.get(kb.name) or o.shape_key_add(name=kb.name, from_mix=False)
            for i, v in enumerate(o.data.vertices): k.data[i].co = v.co + (kb.data[near[i]].co - base.data[near[i]].co)

def rigid(o, arm, bone):
    o.parent = arm; o.vertex_groups.clear()
    vg = o.vertex_groups.new(name=bone); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    if not any(m.type == 'ARMATURE' for m in o.modifiers):
        md = o.modifiers.new('Armature', 'ARMATURE'); md.object = arm

# ── 머리 위 좌표: 경도 lon(정면 0°, 왼쪽 +), 위도 lat(눈높이 근처 0°) → 머리 표면 점 ──
def head_point(P, lon, lat, k=1.0):
    sx, sy, sz = P['head_scale']; r = P['head_r'] * k; a, b = math.radians(lon), math.radians(lat)
    return Vector((r * sx * math.cos(b) * math.sin(a), -r * sy * math.cos(b) * math.cos(a), P['head_c'] + r * sz * math.sin(b)))

def hair_shell(P, k, cutoff, flare=None, cols=48, rows=12):
    """머리보다 k배 큰 껍질. 경도마다 위도 cutoff(lon)부터 정수리까지 격자를 세워 머리선이 매끄럽다."""
    sx, sy, sz = P['head_scale']; r = P['head_r'] * k
    bm = bmesh.new(); grid = []
    for i in range(cols):
        lon = -180 + 360 * i / cols; lo = cutoff(lon); col = []
        for j in range(rows):
            lat = lo + (88 - lo) * (j / (rows - 1)) ** 0.85
            a, b = math.radians(lon), math.radians(lat); f = flare(lon, lat) if flare else 1.0
            col.append(bm.verts.new((r * sx * f * math.cos(b) * math.sin(a), -r * sy * f * math.cos(b) * math.cos(a), P['head_c'] + r * sz * math.sin(b))))
        grid.append(col)
    top = bm.verts.new((0, 0, P['head_c'] + r * sz))
    for i in range(cols):
        a, b = grid[i], grid[(i + 1) % cols]
        for j in range(rows - 1): bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
        bm.faces.new((a[-1], b[-1], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def fringe(lon, base, depth=5.0, n=7, width=40):
    """앞머리 톱니: 정면 ±width° 안에서 끝이 뾰족하게 내려오는 앞머리."""
    if abs(lon) > width: return base
    t = (lon + width) / (2 * width) * n; return base - depth * abs(math.sin(math.pi * t)) * (1 - (abs(lon) / width) ** 4)

def ramp(lon, front, side, back, front_w=38):
    """정면(front) → 옆(90°: side) → 뒤(180°: back)로 매끄럽게 이어지는 잘림선."""
    a = abs(lon)
    if a <= front_w: return front
    if a <= 90: t = (a - front_w) / (90 - front_w); return front + (side - front) * (0.5 - 0.5 * math.cos(math.pi * t))
    t = (a - 90) / 90; return side + (back - side) * (0.5 - 0.5 * math.cos(math.pi * t))

# ── 헤어 8종 ──
def bm_ellipsoid(r, scale, loc):
    b = bm_ball(r, sub=2, z0=0); bmesh.ops.scale(b, vec=scale, verts=b.verts); bmesh.ops.translate(b, vec=loc, verts=b.verts); return b

def bangs(P, lons, lat, size=0.11, k=1.07):
    out = []
    for lon in lons:
        p = head_point(P, lon, lat, k); out.append(bm_ellipsoid(size, (1.0, 0.55, 0.8), p))
    return out

def long_locks(P, K=1.07):
    """긴머리: 귀 아래까지 덮는 껍질 + 머리 곡면을 따라 내려와 등·어깨 뒤로 떨어지는 납작하고 끝이 가는 가닥들.
    가닥 윗부분은 껍질 안쪽에 숨겨 이음새(챙처럼 튀어나온 선)가 안 보이게 한다."""
    sx, sy, sz = P['head_scale']; hr = P['head_r']; hc = P['head_c']
    cut = lambda lon: ramp(lon, 15, -32, -38, front_w=34)
    shell = hair_shell(P, K, lambda lon: fringe(lon, cut(lon), 3, 9, 32), flare=lambda lon, lat: 1 + 0.04 * min(1, max(0, (-5 - lat) / 40)))
    def head_rad(a, z):
        req = hr * K * math.sqrt((sx * math.sin(a)) ** 2 + (sy * math.cos(a)) ** 2); q = (z - hc) / (hr * K * sz)
        return req * math.sqrt(max(0.0, 1 - q * q)) if abs(q) < 1 else 0.0
    def lock(lon, z_end, width, seed):
        b = bmesh.new(); S, M = 16, 8; rows = []; a = math.radians(lon)
        dx, dy = math.sin(a), -math.cos(a); tx, ty = math.cos(a), math.sin(a)
        hang = 0.19 + 0.09 * abs(math.sin(a)); z0 = hc + hr * K * sz * 0.35
        for j in range(S):
            t = j / (S - 1); z = z0 + (z_end - z0) * t; q = (z - hc) / (hr * K * sz)
            lat = math.degrees(math.asin(max(-1, min(1, q)))); hz = head_rad(a, z)
            r = (hz - 0.02) if lat > cut(lon) + 4 else max(hz + 0.01, hang)
            if q < -0.95: r = hang
            r += 0.012 * t; w = width * (1 - 0.7 * t ** 1.5); th = 0.04 * (1 - 0.5 * t); wave = 0.01 * math.sin(t * math.pi * 2.2 + seed)
            row = []
            for i in range(M):
                u = 2 * math.pi * i / M; ox = math.cos(u) * w + wave; oy = math.sin(u) * th
                row.append(b.verts.new((dx * r + tx * ox + dx * oy, dy * r + ty * ox + dy * oy, z)))
            rows.append(row)
        for j in range(S - 1):
            for i in range(M): b.faces.new((rows[j][i], rows[j][(i + 1) % M], rows[j + 1][(i + 1) % M], rows[j + 1][i]))
        c = sum((v.co for v in rows[-1]), Vector()) / M; tip = b.verts.new((c.x, c.y, c.z - 0.025))
        for i in range(M): b.faces.new((rows[-1][i], rows[-1][(i + 1) % M], tip))
        c = sum((v.co for v in rows[0]), Vector()) / M; top = b.verts.new(tuple(c))
        for i in range(M): b.faces.new((rows[0][(i + 1) % M], rows[0][i], top))
        bmesh.ops.recalc_face_normals(b, faces=b.faces); return b
    parts = [shell]; zc = P['chest']
    for k, lon in enumerate([64, 80, 96, 112, 127, 142, 156, 170, -64, -80, -96, -112, -127, -142, -156, -170, 180]):
        back = min(1, (abs(lon) - 64) / 110)
        parts.append(lock(lon, (zc + 0.12) - 0.2 * back + 0.015 * math.sin(k * 1.9), 0.07 + 0.025 * back, k))
    return parts

def build_hair(style_name, P, arm, coll, material, prefix):
    k = 1.07; parts = []
    if style_name == 'short':
        parts = [hair_shell(P, k, lambda lon: fringe(lon, ramp(lon, 20, -5, -35)))]
    elif style_name == 'dandy':
        parts = [hair_shell(P, k, lambda lon: ramp(lon, 13 + 0.3 * max(0, lon), -5, -35) - 4 * max(0, math.cos(math.radians(lon + 25))) ** 6, flare=lambda lon, lat: 1 + 0.06 * max(0, (lat - 30) / 60))]
    elif style_name == 'twoblock':
        parts = [hair_shell(P, 1.11, lambda lon: fringe(lon, ramp(lon, 22, 24, 12), 4, 5)), hair_shell(P, 1.03, lambda lon: ramp(lon, 30, -12, -40))]
    elif style_name == 'spiky':
        parts = [hair_shell(P, k, lambda lon: fringe(lon, ramp(lon, 20, -5, -32), 6, 6))]
        for lon, lat in ((0, 40), (40, 30), (-40, 30), (90, 25), (-90, 25), (140, 30), (-140, 30), (180, 35), (0, 75), (70, 60), (-70, 60), (180, 65)):
            base = head_point(P, lon, lat, 1.02); tip = head_point(P, lon, lat + 8, 1.42); d = tip - base
            c = bm_cyl(0.075, 0.0, d.length, seg=6); rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            bmesh.ops.transform(c, matrix=rot, verts=c.verts); bmesh.ops.translate(c, vec=base, verts=c.verts); parts.append(c)
    elif style_name == 'bob':
        parts = [hair_shell(P, k, lambda lon: fringe(lon, ramp(lon, 15, -58, -62, front_w=32), 3, 9, 32), flare=lambda lon, lat: 1 + 0.2 * min(1, max(0, (-5 - lat) / 50)))]
    elif style_name == 'long':
        parts = long_locks(P)   # 2026-11-08: 납작한 뒷판 → 머리를 감싸며 흘러내리는 가닥 17개
    elif style_name == 'ponytail':
        parts = [hair_shell(P, k, lambda lon: fringe(lon, ramp(lon, 19, -6, -22)))]
        for i, (lat, kk, s) in enumerate(((8, 1.12, 0.1), (-8, 1.22, 0.11), (-25, 1.26, 0.1), (-42, 1.24, 0.085))):
            parts.append(bm_ellipsoid(s, (0.9, 0.9, 1.25), head_point(P, 180, lat, kk)))
    elif style_name == 'bun':
        parts = [hair_shell(P, k, lambda lon: fringe(lon, ramp(lon, 19, -8, -30)))]
        parts.append(bm_ellipsoid(0.14, (1, 1, 0.9), head_point(P, 175, 52, 1.12)))
    name = prefix + '_HAIR_' + style_name   # 웹은 이름 대신 extras(kl_part, kl_type)로 찾는다
    o = obj_from_bm(name, bm_merge(*parts), material, coll)
    for p in o.data.polygons: p.use_smooth = True
    rigid(o, arm, 'head'); o['kl_part'] = 'hair'; o['kl_type'] = style_name
    return o

HAIR_TYPES = ['short', 'dandy', 'twoblock', 'spiky', 'bob', 'long', 'ponytail', 'bun']

# ── 미리보기: 부위를 하나씩 보이게 하고 앞·뒤를 OpenGL 렌더로 저장 ──
def preview(names, out_dir, tag, views=((-30, 'f'), (150, 'b')), center=(0, 0, 1.25), dist=1.9, size=(300, 320), base_show=()):
    import os
    from mathutils import Euler
    area = [a for a in bpy.context.window.screen.areas if a.type == 'VIEW_3D'][0]; reg = [r for r in area.regions if r.type == 'WINDOW'][0]; sp = area.spaces[0]
    sp.shading.type = 'MATERIAL'; sp.overlay.show_overlays = False; sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = size
    files = []
    for n in names:
        for m in names: bpy.data.objects[m].hide_set(m != n)
        for b in base_show: bpy.data.objects[b].hide_set(False)
        for rz, vt in views:
            r3 = sp.region_3d; r3.view_location = Vector(center); r3.view_distance = dist; r3.view_rotation = Euler((math.radians(80), 0, math.radians(rz))).to_quaternion()
            with bpy.context.temp_override(window=bpy.context.window, area=area, region=reg):
                fn = '%s_%s_%s.png' % (tag, n.split('_')[-1], vt); sc.render.filepath = os.path.join(out_dir, fn); bpy.ops.render.opengl(write_still=True, view_context=True); files.append(fn)
    for m in names: bpy.data.objects[m].hide_set(True)
    sp.overlay.show_overlays = True
    return files

# ── 의상·신발·액세서리 ──
def tag(o, part, typ):
    o['kl_part'] = part; o['kl_type'] = typ; return o

def build_outfits(P, arm, body, coll, prefix):
    M = {'top': tint('TINT_top', (0.25, 0.55, 0.85), 0.85), 'bottom': tint('TINT_bottom', (0.15, 0.17, 0.3), 0.85),
         'shoes': tint('TINT_shoes', (0.85, 0.25, 0.25), 0.7), 'acc': tint('TINT_acc', (0.25, 0.25, 0.3), 0.6),
         'sole': mat('FIX_sole', (0.97, 0.96, 0.94), 0.8), 'gold': mat('FIX_gold', (1.0, 0.78, 0.35), 0.35, metal=0.8),
         'detail': mat('FIX_detail', (0.97, 0.96, 0.94), 0.8)}
    pz = P['pelvis']; made = []; kz = P['knee'][1]; az = P['ankle'][1]; nz = P['neck'][0]
    ARM = ('upper_arm', 'lower_arm', 'hand'); LEG = ('upper_leg', 'lower_leg', 'foot')
    isarm = lambda b: bool(b) and b.startswith(ARM); isleg = lambda b: bool(b) and b.startswith(LEG)
    H = lambda z: (Vector((0, 0, z)), Vector((0, 0, 1)))                       # 수평 자르기
    def sleeves(bn, t): return [bone_cut(arm, bn + '.L', t), bone_cut(arm, bn + '.R', t)]
    def G(typ, part, keep, off, cuts, m='top'):
        o = garment_from_body('%s_%s_%s' % (prefix, part.upper(), typ), body, arm, coll, keep, off, M[m], cuts)
        made.append(tag(o, part, typ).name); return o
    hem = pz - 0.05; neckz = nz - 0.015
    body_top = lambda c, b: not isarm(b) and hem < c.z < neckz and b not in ('neck', 'head')
    sleeve = lambda c, b, t, upto: isarm(b) and (b.startswith('upper_arm') and (upto > 1 or t < upto) or (upto > 1 and b.startswith('lower_arm') and t < upto - 1))
    # 상의: 밑단 수평, 소매는 팔뼈에 수직으로
    G('tee', 'top', lambda c, b, t: body_top(c, b) or sleeve(c, b, t, 0.55), 0.016, [H(hem), H(neckz)] + sleeves('upper_arm', 0.55))
    G('long', 'top', lambda c, b, t: body_top(c, b) or sleeve(c, b, t, 1.9), 0.016, [H(hem), H(neckz)] + sleeves('lower_arm', 0.9))
    G('hoodie', 'top', lambda c, b, t: (not isarm(b) and hem - 0.03 < c.z < neckz and b not in ('neck', 'head')) or sleeve(c, b, t, 1.9), 0.022, [H(hem - 0.03), H(neckz)] + sleeves('lower_arm', 0.9))
    G('shirt', 'top', lambda c, b, t: body_top(c, b) or sleeve(c, b, t, 0.6), 0.016, [H(hem), H(neckz)] + sleeves('upper_arm', 0.6))
    G('dress', 'top', lambda c, b, t: not isarm(b) and pz - 0.02 < c.z < neckz - 0.02 and b not in ('neck', 'head'), 0.016, [H(pz - 0.02), H(neckz - 0.02)] + sleeves('upper_arm', 0.02))
    # 하의: 허리선 수평
    waist = pz + 0.04
    G('pants', 'bottom', lambda c, b, t: not isarm(b) and c.z < waist and c.z > az + 0.03, 0.011, [H(waist), H(az + 0.03)], 'bottom')
    G('shorts', 'bottom', lambda c, b, t: not isarm(b) and waist > c.z > kz + (pz - kz) * 0.45, 0.011, [H(waist), H(kz + (pz - kz) * 0.45)], 'bottom')
    # 신발: 발목 위 수평
    G('sneakers', 'shoes', lambda c, b, t: isleg(b) and c.z < az + 0.05, 0.02, [H(az + 0.05)], 'shoes')
    o = garment_from_body('%s_SHOES_sneakers_sole' % prefix, body, arm, coll, lambda c, b, t: isleg(b) and c.z < 0.035, 0.027, M['sole'], [H(0.035)])
    made.append(tag(o, 'shoes', 'sneakers').name)
    G('boots', 'shoes', lambda c, b, t: isleg(b) and c.z < kz - 0.03, 0.023, [H(kz - 0.03)], 'shoes')
    # 후드 모자(목 뒤 늘어진 후드) · 셔츠 카라와 단추 · 원피스 치마
    def ring(z, rx, ry, thick, seg=20, name=None, m='top', bone='chest', part='top', typ=None, flat=0.5):
        b = bm_torus(1.0, thick, seg=seg, rseg=6); bmesh.ops.scale(b, vec=(rx, ry, flat), verts=b.verts); bmesh.ops.translate(b, vec=(0, 0, z), verts=b.verts)
        o = obj_from_bm(name, b, M[m], coll); rigid(o, arm, bone); made.append(tag(o, part, typ).name); return o
    rx, ry = P['r']['chest'][0] * 0.42, P['r']['chest'][1] * 0.42
    hb = bm_ellipsoid(1.0, (P['r']['chest'][0] * 0.55, P['r']['chest'][1] * 0.45, 0.09), (0, P['r']['chest'][1] * 0.32, nz + 0.01))
    o = obj_from_bm('%s_TOP_hoodie_hood' % prefix, hb, M['top'], coll); rigid(o, arm, 'chest'); made.append(tag(o, 'top', 'hoodie').name)
    for s in (-1, 1):
        c = bm_cyl(0.008, 0.008, 0.1, seg=6); bmesh.ops.translate(c, vec=(s * 0.035, -P['r']['chest'][1] * 0.5, nz - 0.1), verts=c.verts)
        o = obj_from_bm('%s_TOP_hoodie_string%s' % (prefix, 'LR'[s > 0]), c, M['detail'], coll); rigid(o, arm, 'chest'); made.append(tag(o, 'top', 'hoodie').name)
    ring(nz - 0.005, rx * 1.05, ry * 1.05, 0.22, name='%s_TOP_shirt_collar' % prefix, m='detail', typ='shirt')
    btn = bm_merge(*[bm_xform(bm_ball(0.012, sub=1), loc=(0, -P['r']['chest'][1] * 0.5 - 0.004, nz - 0.07 - 0.07 * i)) for i in range(3)])
    o = obj_from_bm('%s_TOP_shirt_buttons' % prefix, btn, M['detail'], coll); transfer_from_body(o, body, arm); made.append(tag(o, 'top', 'shirt').name)
    def skirt(name, part, typ, z_top, z_bot, flare, m):
        rxt, ryt = P['r']['pelvis'][0] * 0.62, P['r']['pelvis'][1] * 0.62; b = bmesh.new(); rows = []
        for j in range(6):
            t = j / 5; z = z_top + (z_bot - z_top) * t; f = 1 + flare * t
            rows.append([b.verts.new((rxt * f * math.cos(2 * math.pi * i / 24), ryt * f * math.sin(2 * math.pi * i / 24), z)) for i in range(24)])
        for j in range(5):
            for i in range(24): b.faces.new((rows[j][i], rows[j][(i + 1) % 24], rows[j + 1][(i + 1) % 24], rows[j + 1][i]))
        bmesh.ops.recalc_face_normals(b, faces=b.faces)
        o = obj_from_bm(name, b, M[m], coll)
        for p in o.data.polygons: p.use_smooth = True
        transfer_from_body(o, body, arm); made.append(tag(o, part, typ).name); return o
    skirt('%s_TOP_dress_skirt' % prefix, 'top', 'dress', pz + 0.0, kz + 0.04, 0.55, 'top')
    skirt('%s_BOTTOM_skirt' % prefix, 'bottom', 'skirt', pz + 0.03, kz + 0.06, 0.45, 'bottom')
    return made

def build_accessories(P, arm, body, coll, prefix):
    M = {'acc': bpy.data.materials['TINT_acc'], 'gold': bpy.data.materials['FIX_gold'], 'detail': bpy.data.materials['FIX_detail']}
    made = []
    def R(name, bm, m, bone, typ):
        o = obj_from_bm('%s_ACC_%s' % (prefix, name), bm, M[m], coll)
        for p in o.data.polygons: p.use_smooth = True
        rigid(o, arm, bone); made.append(tag(o, 'acc', typ).name); return o
    # 안경: 눈 위치(경도 ±17°, 위도 -6°) 앞
    parts = []
    for s in (-1, 1):
        c = head_point(P, s * 17, -6, 1.06)
        parts.append(bm_xform(bm_torus(0.062, 0.008, seg=20, rseg=5), loc=c, rot=(math.pi / 2, 0, math.radians(-s * 17))))
        e = head_point(P, s * 62, -4, 1.04); parts.append(bm_xform(bm_box(0.01, 0.01, 0.01), loc=e))
        a, b2 = head_point(P, s * 30, -5, 1.07), head_point(P, s * 85, -3, 1.02); d = b2 - a
        arm_b = bm_box(0.012, d.length, 0.012); bmesh.ops.transform(arm_b, matrix=d.to_track_quat('Y', 'Z').to_matrix().to_4x4(), verts=arm_b.verts)
        bmesh.ops.translate(arm_b, vec=(a + b2) / 2 - Vector((0, 0, 0.006)), verts=arm_b.verts); parts.append(arm_b)
    br = head_point(P, 0, -4, 1.08); parts.append(bm_xform(bm_box(0.06, 0.012, 0.012), loc=br))
    R('glasses', bm_merge(*parts), 'acc', 'head', 'glasses')
    # 캡모자 / 비니(머리카락 위에 씀)
    cap = hair_shell(P, 1.14, lambda lon: 12 if abs(lon) < 60 else ramp(lon, 12, 2, -8), rows=8)
    sx, sy, _ = P['head_scale']; br_r = P['head_r'] * 1.14
    # 챙: 두께가 있는 반달 판을 이마 앞에 살짝 아래로 기울여 붙임(얇은 원판은 옆에서 보면 선처럼 보였음)
    def half_disc(rx, ry, th, n=16):
        bm = bmesh.new(); top = []; bot = []
        for i in range(n + 1):
            t = math.pi + math.pi * i / n; x, y = rx * math.cos(t), ry * math.sin(t)   # 앞쪽(-Y) 반달
            top.append(bm.verts.new((x, y, th / 2))); bot.append(bm.verts.new((x, y, -th / 2)))
        bm.faces.new(top); bm.faces.new(bot[::-1])
        for i in range(n): bm.faces.new((bot[i], bot[i + 1], top[i + 1], top[i]))
        bm.faces.new((bot[n], bot[0], top[0], top[n]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); return bm
    brim = half_disc(br_r * sx * 0.72, br_r * sy * 0.62, 0.035)
    bmesh.ops.transform(brim, matrix=Matrix.Rotation(math.radians(16), 4, 'X'), verts=brim.verts)
    bmesh.ops.translate(brim, vec=head_point(P, 0, 13, 1.1) + Vector((0, 0.05, -0.015)), verts=brim.verts)
    R('cap', bm_merge(cap, brim), 'acc', 'head', 'cap')
    bea = hair_shell(P, 1.16, lambda lon: ramp(lon, 22, 8, -5), rows=8, flare=lambda lon, lat: 1 + 0.04 * max(0, (lat - 40) / 50))
    rim = bm_torus(1.0, 0.07, seg=32, rseg=6); bmesh.ops.scale(rim, vec=(P['head_r'] * 1.15 * sx, P['head_r'] * 1.15 * sy, 0.5), verts=rim.verts)
    bmesh.ops.translate(rim, vec=(0, 0, head_point(P, 90, 10, 1.15).z - 0.01), verts=rim.verts)
    R('beanie', bm_merge(bea, rim), 'acc', 'head', 'beanie')
    # 귀걸이(머리 옆 아래)
    ea = []
    for s in (-1, 1):
        p = head_point(P, s * 88, -32, 1.02); ea += [bm_xform(bm_ball(0.018, sub=1), loc=p), bm_xform(bm_torus(0.025, 0.006, seg=12, rseg=4), loc=p - Vector((0, 0, 0.035)), rot=(0, math.pi / 2, 0))]
    R('earrings', bm_merge(*ea), 'gold', 'head', 'earrings')
    # 크로스백: 대각선 끈 + 왼쪽 엉덩이 쪽 가방 (몸 가중치를 옮겨 받음)
    cz, pz = P['chest'], P['pelvis']; rx, ry = P['r']['chest'][0] * 0.62 + 0.03, P['r']['chest'][1] * 0.62 + 0.03
    strap = bm_torus(1.0, 0.018, seg=32, rseg=4); bmesh.ops.scale(strap, vec=(rx * 1.05, ry * 1.08, 1), verts=strap.verts)
    bmesh.ops.transform(strap, matrix=Matrix.Rotation(math.radians(-38), 4, 'Y'), verts=strap.verts); bmesh.ops.translate(strap, vec=(0, 0, (cz + pz) / 2 + 0.04), verts=strap.verts)
    bag = bm_box(0.16, 0.07, 0.13); bmesh.ops.translate(bag, vec=(P['r']['pelvis'][0] * 0.5 + 0.02, -0.02, pz - 0.06), verts=bag.verts)
    o = obj_from_bm('%s_ACC_crossbag' % prefix, bm_merge(strap, bag), M['acc'], coll); transfer_from_body(o, body, arm); made.append(tag(o, 'acc', 'crossbag').name)
    return made

# ── 내보내기: avatar_<style>.glb (얼굴은 웹이 그리므로 미리보기 얼굴 이미지는 빼고 내보냄) ──
def export_avatar(style):
    import os
    arm = bpy.data.objects['AV_%s_RIG' % style]; C = bpy.data.collections['AVATAR_' + style]
    fm = bpy.data.materials['MAT_av_face']; nt = fm.node_tree; tex = nt.nodes.get('FaceTex')
    if tex:
        for l in list(tex.outputs['Color'].links): nt.links.remove(l)
    hidden = [o for o in C.objects if o.hide_get()]
    for o in C.objects: o.hide_set(False)
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in C.objects: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    dst = os.path.expanduser('~/Desktop/keylink/public/plaza/assets/avatar_%s.glb' % style)
    bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, use_active_scene=True, export_extras=True, export_yup=True, export_apply=False,
        export_animations=True, export_animation_mode='ACTIONS', export_skins=True, export_morph=True, export_morph_normal=False, export_cameras=False, export_lights=False)
    for o in C.objects: o.select_set(False)
    for o in hidden: o.hide_set(True)
    if tex:   # Blender 미리보기용으로 다시 연결
        b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]; nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    return os.path.getsize(dst)


# ── 열쇠 보상 액세서리(귀여운): 황금 키링(누적 3일) · 왕관(누적 10일) ──
def build_reward_accessories(P, arm, coll, prefix):
    gold = bpy.data.materials['FIX_gold']; gem = mat('FIX_gem', (1.0, 0.45, 0.7), 0.3, emit=(1.0, 0.3, 0.6), emit_str=0.6); made = []
    # 왕관: 머리카락 위 금색 띠 + 뾰족 5개 + 보석
    top = P['head_c'] + P['head_r'] * P['head_scale'][2] * 0.9; r = P['head_r'] * 0.62
    parts = [bm_xform(bm_ring(r, r - 0.025, 0.09, seg=24), loc=(0, 0, top - 0.02))]
    for i in range(5):
        a = 2 * math.pi * i / 5; parts.append(bm_xform(bm_cyl(0.04, 0.0, 0.11, seg=6), loc=(r * math.sin(a) * 0.96, -r * math.cos(a) * 0.96, top + 0.07)))
    o = obj_from_bm('%s_ACC_crown' % prefix, bm_merge(*parts), gold, coll); rigid(o, arm, 'head'); o['kl_part'] = 'acc'; o['kl_type'] = 'crown'; made.append(o.name)
    g = obj_from_bm('%s_ACC_crown_gem' % prefix, bm_xform(bm_ball(0.03, sub=1), loc=(0, -r - 0.005, top + 0.025)), gem, coll); rigid(g, arm, 'head'); g['kl_part'] = 'acc'; g['kl_type'] = 'crown'; made.append(g.name)
    # 황금 키링: 오른쪽 허리춤에 달린 고리 + 열쇠
    x = -P['r']['pelvis'][0] * 0.62; z = P['pelvis'] - 0.02; y = -P['r']['pelvis'][1] * 0.35
    kp = [bm_xform(bm_torus(0.06, 0.012, seg=16, rseg=5), loc=(x, y, z), rot=(0, math.pi / 2, 0)),
          bm_xform(bm_box(0.012, 0.02, 0.12), loc=(x, y, z - 0.17)), bm_xform(bm_torus(0.025, 0.01, seg=12, rseg=4), loc=(x, y, z - 0.06), rot=(0, math.pi / 2, 0)),
          bm_xform(bm_box(0.012, 0.04, 0.015), loc=(x, y - 0.02, z - 0.15))]
    k = obj_from_bm('%s_ACC_goldkeyring' % prefix, bm_merge(*kp), gold, coll); rigid(k, arm, 'hips'); k['kl_part'] = 'acc'; k['kl_type'] = 'goldkeyring'; made.append(k.name)
    return made

# ── 상점 꾸미기(귀여운): 하트 풍선 · 천사 링 · 날개 — 색 고정(FIX_) ──
def build_shop_accessories(P, arm, coll, prefix):
    J = joints(P); made = []
    white = mat('FIX_wing', (0.98, 0.97, 1.0), 0.6); edge = bpy.data.materials['FIX_gold']
    halo = mat('FIX_halo', (1.0, 0.85, 0.35), 0.3, emit=(1.0, 0.8, 0.3), emit_str=1.6)
    pink = mat('FIX_balloon', (1.0, 0.36, 0.55), 0.25)
    def put(name, bm, m, bone, typ):
        o = obj_from_bm('%s_ACC_%s' % (prefix, name), bm, m, coll)
        for p in o.data.polygons: p.use_smooth = True
        rigid(o, arm, bone); o['kl_part'] = 'acc'; o['kl_type'] = typ; made.append(o.name)
    top = P['head_c'] + P['head_r'] * P['head_scale'][2]
    put('halo', bm_xform(bm_torus(P['head_r'] * 0.55, 0.035, seg=32, rseg=8), loc=(0, 0.02, top + 0.16)), halo, 'head', 'halo')
    # 날개: 깃털 끝이 물결치는 판을 등 뒤 좌우로
    cy = P['r']['chest'][1] * 0.5 + 0.03; zc = P['chest']
    pts = [(0, 0), (0.18, 0.16), (0.36, 0.26), (0.5, 0.24), (0.46, 0.12), (0.5, 0.02), (0.42, -0.06), (0.44, -0.16), (0.32, -0.18), (0.3, -0.28), (0.16, -0.22), (0.05, -0.12)]
    for s in (1, -1):
        b = bmesh.new(); f = [b.verts.new((s * x, 0, z)) for x, z in pts]; b_ = [b.verts.new((s * x, 0.035, z)) for x, z in pts]
        b.faces.new(f if s > 0 else f[::-1]); b.faces.new(b_[::-1] if s > 0 else b_)
        n = len(pts)
        for i in range(n): b.faces.new((f[i], f[(i + 1) % n], b_[(i + 1) % n], b_[i]))
        bmesh.ops.recalc_face_normals(b, faces=b.faces)
        bmesh.ops.transform(b, matrix=Matrix.Rotation(-s * 0.35, 4, 'Z'), verts=b.verts)
        bmesh.ops.translate(b, vec=(s * 0.06, cy, zc + 0.05), verts=b.verts)
        put('wings_%s' % ('L' if s > 0 else 'R'), b, white, 'chest', 'wings')
    # 하트 풍선: 오른손에서 위로 올라간 줄 + 하트
    h = J['hand.R']; bx, bz = h.x - 0.2, h.z + 1.15
    put('balloon', bm_xform(bm_heart(0.42, 0.18), loc=(bx, 0.0, bz)), pink, 'hand.R', 'balloon')
    d = Vector((bx - h.x, 0, bz - 0.2 - h.z)); st = bm_box(0.008, 0.008, d.length)
    bmesh.ops.transform(st, matrix=d.to_track_quat('Z', 'Y').to_matrix().to_4x4(), verts=st.verts); bmesh.ops.translate(st, vec=(h.x, 0, h.z), verts=st.verts)
    put('balloon_string', st, bpy.data.materials['FIX_detail'], 'hand.R', 'balloon')
    return made
