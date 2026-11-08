# 키링 월드 크리스마스 꾸미기(시즌 한정 상점) — 산타 모자 · 루돌프 뿔(+빨간 코) · 목도리
# build_avatar.py → build_avatar_parts.py → build_avatar_block.py 를 exec한 다음 이 파일을 exec.
# 귀여운(chibi)·블록(block) 그림체 모두 같은 kl_type(santa / antlers / scarf)으로 만든다(웹 avatar.js가 이름으로 켜고 끔).
# 색은 고정(FIX_) — 산타 모자는 빨강·흰색, 뿔은 갈색, 목도리는 빨강.
import bpy, bmesh, math
from mathutils import Vector, Matrix

XM = {
    'red': mat('FIX_santa_red', (0.78, 0.06, 0.09), 0.7),
    'white': mat('FIX_santa_white', (0.97, 0.97, 0.95), 0.9),
    'antler': mat('FIX_antler', (0.42, 0.26, 0.13), 0.8),
    'nose': mat('FIX_rudolph_nose', (0.95, 0.08, 0.12), 0.3, emit=(1.0, 0.1, 0.12), emit_str=1.2),
    'scarf': mat('FIX_scarf', (0.72, 0.08, 0.12), 0.85),
    'scarf2': mat('FIX_scarf_stripe', (0.96, 0.94, 0.9), 0.85),
}


def build_chibi_xmas(P, arm, coll, prefix='chibi'):
    made = []
    def put(name, bm, m, bone, typ):
        o = obj_from_bm('%s_ACC_%s' % (prefix, name), bm, m, coll)
        for p in o.data.polygons: p.use_smooth = True
        rigid(o, arm, bone); o['kl_part'] = 'acc'; o['kl_type'] = typ; made.append(o.name)
    sx, sy, sz = P['head_scale']; r = P['head_r']; hc = P['head_c']
    # 산타 모자: 흰 털 테두리(머리 위쪽 둘레) + 뒤로 꺾인 빨간 원뿔 + 끝의 흰 방울
    lat = math.radians(24); zb = hc + r * sz * math.sin(lat); rb = r * math.cos(lat)
    # 머리카락(머리 중심에서 약 0.41m)보다 확실히 바깥에 두어 겹쳐 지글거리지 않게
    rim = bm_torus(1.0, 0.085, seg=36, rseg=8); bmesh.ops.scale(rim, vec=(rb * sx * 1.16, rb * sy * 1.16, 1.0), verts=rim.verts)
    bmesh.ops.translate(rim, vec=(0, 0, zb), verts=rim.verts)
    # 원뿔 밑면이 털 테두리 중심선보다 좁으면 그 사이로 정수리 머리카락이 보여 모자가 떠 보인다 → 테두리 안쪽까지 넓히고 테두리 속에서 시작
    # 고리 두 개(밑면·끝)뿐이면 휘게 해도 옆면이 곧은 비탈이 되어 앞쪽 머리카락이 뚫고 나온다 → 고리 여러 개로 둥글게 부푼 원뿔
    cone = bmesh.new(); RINGS, SEG, H = 12, 28, 0.66; rows = []
    for i in range(RINGS + 1):
        t = i / RINGS; rr = rb * 1.22 * (1 - t) ** 0.8 + 0.02 * t
        rows.append([cone.verts.new((rr * sx * math.cos(2 * math.pi * k / SEG), rr * sy * math.sin(2 * math.pi * k / SEG), H * t)) for k in range(SEG)])
    for a, b in zip(rows, rows[1:]):
        for k in range(SEG): cone.faces.new((a[k], a[(k + 1) % SEG], b[(k + 1) % SEG], b[k]))
    cone.faces.new(rows[-1])
    # 위로 갈수록 뒤(+Y)로 휘게
    for v in cone.verts:
        t = max(0.0, v.co.z) / H; v.co.y += 0.32 * t * t; v.co.z -= 0.12 * t * t
    bmesh.ops.recalc_face_normals(cone, faces=cone.faces)
    bmesh.ops.translate(cone, vec=(0, 0, zb - 0.03), verts=cone.verts)
    tip = Vector((0, 0.32, zb - 0.03 + 0.66 - 0.12))
    pom = bm_ball(0.075, sub=2, z0=0); bmesh.ops.translate(pom, vec=tip, verts=pom.verts)
    put('santa', cone, XM['red'], 'head', 'santa')
    put('santa_trim', bm_merge(rim, pom), XM['white'], 'head', 'santa')
    # 루돌프 뿔: 머리 위 양옆에서 갈래로 뻗은 뿔 + 빨간 코
    parts = []
    for s in (-1, 1):
        base = head_point(P, s * 38, 58, 0.97)
        def stick(p0, d, ln, rad):
            b = bm_cyl(rad, rad * 0.75, ln, seg=8)
            q = Vector(d).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
            bmesh.ops.transform(b, matrix=q, verts=b.verts); bmesh.ops.translate(b, vec=p0, verts=b.verts); return b
        main_d = Vector((s * 0.45, 0.1, 1.0)); parts.append(stick(base, main_d, 0.3, 0.028))
        mid = base + main_d.normalized() * 0.16
        parts.append(stick(mid, Vector((s * 1.0, -0.15, 0.55)), 0.16, 0.022))
        top = base + main_d.normalized() * 0.3
        parts.append(stick(top - main_d.normalized() * 0.02, Vector((-s * 0.3, 0.1, 1.0)), 0.12, 0.018))
        parts.append(stick(top - main_d.normalized() * 0.02, Vector((s * 1.0, 0.2, 0.6)), 0.12, 0.018))
    put('antlers', bm_merge(*parts), XM['antler'], 'head', 'antlers')
    nose = bm_ball(0.045, sub=2, z0=0); bmesh.ops.translate(nose, vec=head_point(P, 0, -10, 1.02), verts=nose.verts)
    put('antlers_nose', nose, XM['nose'], 'head', 'antlers')
    # 목도리: 목둘레 고리 + 앞으로 늘어진 끝(흰 줄무늬)
    cz = P['chest'] + 0.15; rx, ry = P['r']['chest'][0] * 0.62, P['r']['chest'][1] * 0.75
    ring = bm_torus(1.0, 0.065, seg=32, rseg=8); bmesh.ops.scale(ring, vec=(rx, ry, 1.0), verts=ring.verts); bmesh.ops.translate(ring, vec=(0, 0, cz), verts=ring.verts)
    tail = bm_box(0.11, 0.035, 0.24); bmesh.ops.transform(tail, matrix=Matrix.Rotation(-0.12, 4, 'Y'), verts=tail.verts)
    bmesh.ops.translate(tail, vec=(rx * 0.35, -ry - 0.03, cz - 0.2), verts=tail.verts)
    put('scarf', bm_merge(ring, tail), XM['scarf'], 'chest', 'scarf')
    stripes = [bm_xform(bm_box(0.115, 0.04, 0.025), loc=(rx * 0.35 - 0.01, -ry - 0.03, cz - 0.2 + dz), rot=(0, -0.12, 0)) for dz in (-0.07, 0.0)]
    put('scarf_stripe', bm_merge(*stripes), XM['scarf2'], 'chest', 'scarf')
    return made


def build_block_xmas(coll, arm):
    X, Y, z0, z1 = HEAD['hx'], HEAD['hy'], HEAD['z0'], HEAD['z1']; cz = (z0 + z1) / 2; made = []
    def mk(name, B, m, typ): made.append(part(B, 'block_ACC_' + name, coll, arm, m, 'acc', typ, keys=False).name)
    # 산타 모자: 흰 띠 + 위로 갈수록 작아지며 뒤로 넘어가는 빨간 상자 + 흰 방울
    # 머리카락 상자(가로 ±0.37, 깊이 ±0.35, 정수리 z1+0.05~0.11)보다 크게 덮어야 머리카락이 모자를 뚫고 나오거나 겹쳐서 지글거리지 않는다
    R_ = Boxes(); W_ = Boxes()
    W_.add('head', -0.41, -0.39, z1 - 0.08, 0.41, 0.39, z1 + 0.06)            # 흰 털 띠(머리카락보다 바깥)
    R_.add('head', -0.38, -0.36, z1 + 0.06, 0.38, 0.36, z1 + 0.17)            # 정수리를 덮는 빨간 몸통
    R_.add('head', -0.27, -0.2, z1 + 0.17, 0.27, 0.36, z1 + 0.29)
    R_.add('head', -0.16, -0.04, z1 + 0.29, 0.16, 0.42, z1 + 0.37)
    R_.add('head', -0.08, 0.36, z1 + 0.15, 0.08, 0.5, z1 + 0.31)             # 뒤로 꺾여 내려오는 끝
    W_.add('head', -0.085, 0.44, z1 + 0.06, 0.085, 0.6, z1 + 0.22)           # 끝의 흰 방울
    mk('santa', R_, XM['red'], 'santa'); mk('santa_trim', W_, XM['white'], 'santa')
    # 루돌프 뿔: 머리 위 양옆 갈래 + 얼굴 가운데 빨간 코
    A = Boxes(); t = 0.035
    for s in (1, -1):
        x0 = s * 0.17
        def bx(xa, xb, za, zb): A.add('head', min(xa, xb), -t, za, max(xa, xb), t, zb)
        bx(x0 - t, x0 + t, z1, z1 + 0.3)                                   # 줄기
        bx(x0, x0 + s * 0.17, z1 + 0.14, z1 + 0.14 + 2 * t)                 # 바깥 가지
        bx(x0 + s * 0.17 - t, x0 + s * 0.17 + t, z1 + 0.14, z1 + 0.3)       # 바깥 가지 끝 위로
        bx(x0, x0 - s * 0.1, z1 + 0.24, z1 + 0.24 + 2 * t)                  # 안쪽 작은 가지
    mk('antlers', A, XM['antler'], 'antlers')
    N = Boxes(); N.add('head', -0.05, -Y - 0.06, 1.37, 0.05, -Y + 0.01, 1.45); mk('antlers_nose', N, XM['nose'], 'antlers')
    # 목도리: 목둘레 네모 고리 + 앞으로 늘어진 끝(흰 줄)
    S = Boxes(); za, zb = 1.13, 1.25; ex, ey, th = 0.29, 0.19, 0.06
    S.add('chest', -ex, -ey, za, ex, -ey + th, zb); S.add('chest', -ex, ey - th, za, ex, ey, zb)
    S.add('chest', -ex, -ey, za, -ex + th, ey, zb); S.add('chest', ex - th, -ey, za, ex, ey, zb)
    S.add('chest', 0.05, -ey - 0.02, 0.9, 0.17, -ey + 0.03, za)
    mk('scarf', S, XM['scarf'], 'scarf')
    T = Boxes()
    for zz in (0.95, 1.03): T.add('chest', 0.045, -ey - 0.03, zz, 0.175, -ey + 0.035, zz + 0.03)
    mk('scarf_stripe', T, XM['scarf2'], 'scarf')
    return made
