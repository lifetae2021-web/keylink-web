# 키링 월드 블록 캐릭터 — build_avatar.py · build_avatar_parts.py 다음에 exec로 실행. 설계: avatar_spec.md
# 모든 부위가 상자이고, 상자마다 뼈 하나를 100% 따라간다(블록 캐릭터의 고전적인 리그). 뼈 이름·동작·부위 이름·재질 규칙은 귀여운 캐릭터와 같다.
# Blender에서 -Y를 바라봄(웹 +Z). 단위 m.
import bpy, bmesh, math
from mathutils import Vector, Matrix

BJ = dict(pelvis=0.74, spine=0.90, chest=1.04, neck=1.18, head_base=1.22, head_top=1.86,
          hip=(0.115, 0.70), knee=(0.115, 0.40), ankle=(0.115, 0.12), toe=(0.115, -0.13, 0.05),
          shoulder=(0.335, 1.15), elbow=(0.345, 0.91), wrist=(0.35, 0.69), hand=(0.352, 0.60))
HEAD = dict(cx=0.0, cy=0.0, z0=1.22, z1=1.86, hx=0.32, hy=0.30)   # 머리 상자
FACE_SPAN = 30.0   # 머리 앞면 = 얼굴 텍스처의 경도·위도 ±30° (drawFace 그대로 사용, 눈·입이 적당히 크게)

def block_joints():
    J = {'pelvis': (0, 0, BJ['pelvis']), 'spine': (0, 0, BJ['spine']), 'chest': (0, 0, BJ['chest']), 'neck': (0, 0, BJ['neck']),
         'head_base': (0, 0, BJ['head_base']), 'head_top': (0, 0, BJ['head_top'])}
    for s, sx in (('L', 1), ('R', -1)):
        for k in ('hip', 'knee', 'ankle', 'shoulder', 'elbow', 'wrist', 'hand'):
            x, z = BJ[k]; J['%s.%s' % (k, s)] = (sx * x, 0, z)
        x, y, z = BJ['toe']; J['toe.' + s] = (sx * x, y, z)
    return {k: Vector(v) for k, v in J.items()}

class Boxes:
    """상자를 모아 한 메시로 — 상자마다 따라갈 뼈를 기록해 두고 가중치 1.0으로 묶는다."""
    def __init__(self): self.items = []
    def add(self, bone, x0, y0, z0, x1, y1, z1, mi=0):
        self.items.append((bone, (min(x0, x1), min(y0, y1), min(z0, z1), max(x0, x1), max(y0, y1), max(z0, z1)), mi))
    def sym(self, bone, x0, y0, z0, x1, y1, z1, mi=0):   # 왼쪽(+X) 기준으로 주면 오른쪽(-X)도
        self.add(bone + '.L', x0, y0, z0, x1, y1, z1, mi); self.add(bone + '.R', -x1, y0, z0, -x0, y1, z1, mi)
    def build(self, name, coll, arm, mats, face_uv=False):
        drop(name); bm = bmesh.new(); vgroups = []
        for bone, (x0, y0, z0, x1, y1, z1), mi in self.items:
            vs = [bm.verts.new((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
            F = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
            for f in F:
                face = bm.faces.new([vs[i] for i in f]); face.material_index = mi
            vgroups.append(bone)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if face_uv: head_face_uv(bm)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        for m in mats: me.materials.append(m)
        o = bpy.data.objects.new(name, me); coll.objects.link(o); o.parent = arm
        md = o.modifiers.new('Armature', 'ARMATURE'); md.object = arm
        for i, bone in enumerate(vgroups):
            vg = o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone); vg.add(range(i * 8, i * 8 + 8), 1.0, 'REPLACE')
        for p in me.polygons: p.use_smooth = False
        return o

def head_face_uv(bm):
    """머리 앞면(-Y)은 얼굴 텍스처 가운데(경도·위도 ±FACE_SPAN°), 나머지 면은 뒤통수 쪽(피부색만 있는 곳)."""
    uv = bm.loops.layers.uv.verify(); bm.normal_update()
    cz = (HEAD['z0'] + HEAD['z1']) / 2; hz = (HEAD['z1'] - HEAD['z0']) / 2
    du, dv = FACE_SPAN / 360.0, FACE_SPAN / 180.0
    for f in bm.faces:
        front = f.normal.y < -0.9
        for l in f.loops:
            c = l.vert.co
            if front: l[uv].uv = (0.5 + (c.x / HEAD['hx']) * du, 0.5 + ((c.z - cz) / hz) * dv)
            else: l[uv].uv = (0.02, 0.5)

def body_boxes(e=0.0):
    """맨몸 상자(e: 바깥으로 부풀리는 두께 — 옷을 같은 모양으로 만들 때 씀)."""
    B = Boxes(); hx = 0.25
    B.add('hips', -hx - e, -0.14 - e, 0.66, hx + e, 0.14 + e, 0.82)
    B.add('spine', -hx - e, -0.14 - e, 0.82, hx + e, 0.14 + e, 0.99)
    B.add('chest', -hx - e, -0.145 - e, 0.99, hx + e, 0.145 + e, 1.18)
    return B

def limb_box(B, bone, a, b, w, d, e=0.0, t0=0.0, t1=1.0, mi=0):
    """뼈 구간 a→b(세로로 거의 곧은 팔·다리)를 감싸는 상자. t0~t1로 일부만."""
    za, zb = a.z + (b.z - a.z) * t0, a.z + (b.z - a.z) * t1; x = (a.x + b.x) / 2
    B.add(bone, x - w / 2 - e, -d / 2 - e, min(za, zb), x + w / 2 + e, d / 2 + e, max(za, zb), mi)

def build_block_body(coll, arm, J, skin, face):
    B = body_boxes()
    B.add('neck', -0.09, -0.08, 1.16, 0.09, 0.08, 1.23)
    for s in 'LR':
        limb_box(B, 'upper_leg.' + s, J['hip.' + s], J['knee.' + s], 0.21, 0.22)
        limb_box(B, 'lower_leg.' + s, J['knee.' + s], J['ankle.' + s], 0.2, 0.21)
        a = J['ankle.' + s]; B.add('foot.' + s, a.x - 0.1, -0.17, 0.0, a.x + 0.1, 0.1, 0.12)
        limb_box(B, 'upper_arm.' + s, J['shoulder.' + s] + Vector((0, 0, 0.05)), J['elbow.' + s], 0.17, 0.18)
        limb_box(B, 'lower_arm.' + s, J['elbow.' + s], J['wrist.' + s], 0.16, 0.17)
        h = J['wrist.' + s]; B.add('hand.' + s, h.x - 0.08, -0.08, h.z - 0.15, h.x + 0.08, 0.08, h.z)
    body = B.build('AV_block_BODY', coll, arm, [skin])
    H = Boxes(); H.add('head', -HEAD['hx'], -HEAD['hy'], HEAD['z0'], HEAD['hx'], HEAD['hy'], HEAD['z1'])
    head = H.build('AV_block_HEAD', coll, arm, [face], face_uv=True)
    return body, head

# ── 슬라이더용 셰이프 키(이름은 귀여운 캐릭터와 같음) ──
def bone_axis_point(arm, bone, co):
    b = arm.data.bones[bone]; h, t = b.head_local, b.tail_local; d = t - h
    k = max(0.0, min(1.0, (co - h).dot(d) / d.length_squared)); return h + d * k

def add_block_body_keys(o, arm):
    me = o.data
    if not me.shape_keys: o.shape_key_add(name='Basis')
    base = [v.co.copy() for v in me.vertices]
    vb = [o.vertex_groups[v.groups[0].group].name if v.groups else None for v in me.vertices]
    def key(name, fn):
        k = me.shape_keys.key_blocks.get(name) or o.shape_key_add(name=name, from_mix=False)
        for i, co in enumerate(base): k.data[i].co = fn(i, co)
    def radial(i, co, s):
        if not vb[i] or vb[i] in ('head',): return co.copy()
        a = bone_axis_point(arm, vb[i], co); r = co - a; return a + Vector((r.x * s, r.y * s, r.z))
    key('build_slim', lambda i, co: radial(i, co, 0.85))
    key('build_broad', lambda i, co: radial(i, co, 1.18))
    def fem(i, co):
        c = co.copy(); b = vb[i]
        if b == 'hips': c.x *= 1.08
        elif b == 'spine': c.x *= 0.88
        elif b == 'chest': c.x *= 0.92
        elif b and b.startswith('upper_arm'): c.x -= 0.025 * (1 if c.x > 0 else -1)
        return c
    key('female', fem)

def add_block_head_keys(o):
    me = o.data
    if not me.shape_keys: o.shape_key_add(name='Basis')
    base = [v.co.copy() for v in me.vertices]; z0, z1 = HEAD['z0'], HEAD['z1']; cz = (z0 + z1) / 2
    def key(name, fn):
        k = me.shape_keys.key_blocks.get(name) or o.shape_key_add(name=name, from_mix=False)
        for i, co in enumerate(base): k.data[i].co = fn(co)
    key('face_long', lambda c: Vector((c.x, c.y, c.z - 0.07 if c.z < cz else c.z)))
    key('face_vline', lambda c: Vector((c.x * (0.82 if c.z < cz else 1.0), c.y, c.z)))
    key('cheek_full', lambda c: Vector((c.x * (1.08 if c.z < cz + 0.05 else 1.0), c.y, c.z)))

# ── 블록 부위: 헤어 8 · 상의 5 · 하의 3 · 신발 2 · 액세서리 5 ──
def part(B, name, coll, arm, mat, kind, typ, keys=True):
    o = B.build(name, coll, arm, [mat]); o['kl_part'] = kind; o['kl_type'] = typ
    if keys: add_block_body_keys(o, arm)
    return o

def build_block_hair(coll, arm, mat):
    X, Y, z0, z1 = HEAD['hx'], HEAD['hy'], HEAD['z0'], HEAD['z1']; t = 0.05; made = []
    def cap(B, top=z1 + t, side_to=z1 - 0.26, back_to=z1 - 0.42, fx=X + t, fy=Y + t):
        B.add('head', -fx, -fy, z1, fx, fy, top)                       # 정수리
        B.add('head', -fx, fy - t, back_to, fx, fy, z1)                # 뒤
        B.add('head', -fx, -fy, side_to, -X, fy, z1); B.add('head', X, -fy, side_to, fx, fy, z1)   # 옆
    def fringe(B, blocks, fy=Y + t):
        for x0, x1, zb in blocks: B.add('head', x0, -fy, zb, x1, -Y, z1)
    def mk(typ, B): made.append(part(B, 'block_HAIR_' + typ, coll, arm, mat, 'hair', typ, keys=False).name)
    B = Boxes(); cap(B); fringe(B, [(-X - t, -0.12, z1 - 0.16), (-0.12, 0.1, z1 - 0.12), (0.1, X + t, z1 - 0.15)]); mk('short', B)
    B = Boxes(); cap(B); fringe(B, [(-X - t, -0.02, z1 - 0.2), (-0.02, X + t, z1 - 0.1)]); B.add('head', -X - t, -Y - t, z1, 0.05, Y + t, z1 + t + 0.04); mk('dandy', B)
    B = Boxes(); cap(B, top=z1 + 0.11, side_to=z1 - 0.12, back_to=z1 - 0.2); fringe(B, [(-X - t, X + t, z1 - 0.08)]); mk('twoblock', B)
    B = Boxes(); cap(B); fringe(B, [(-X - t, X + t, z1 - 0.1)])
    for i, (x, y) in enumerate(((-0.2, -0.1), (0.0, -0.18), (0.2, -0.1), (-0.12, 0.12), (0.12, 0.12), (0.0, 0.0))):
        h = 0.1 + 0.04 * (i % 3); B.add('head', x - 0.06, y - 0.06, z1 + t, x + 0.06, y + 0.06, z1 + t + h)
    mk('spiky', B)
    B = Boxes(); cap(B, side_to=z0 + 0.12, back_to=z0 + 0.08); fringe(B, [(-X - t, X + t, z1 - 0.14)]); mk('bob', B)
    B = Boxes(); cap(B, side_to=z0 + 0.05, back_to=z0 + 0.05); fringe(B, [(-X - t, -0.04, z1 - 0.14), (0.04, X + t, z1 - 0.14)])
    B.add('head', -X - t + 0.02, Y - 0.02, z0 - 0.38, X + t - 0.02, Y + t, z0 + 0.06); mk('long', B)   # 등까지 내려오는 머리(머리 뼈를 따라감)
    B = Boxes(); cap(B, side_to=z1 - 0.3, back_to=z1 - 0.36); fringe(B, [(-X - t, X + t, z1 - 0.13)])
    B.add('head', -0.08, Y + t, z1 - 0.2, 0.08, Y + t + 0.1, z1 - 0.06); B.add('head', -0.07, Y + t, z1 - 0.55, 0.07, Y + t + 0.12, z1 - 0.2); mk('ponytail', B)
    B = Boxes(); cap(B, side_to=z1 - 0.28, back_to=z1 - 0.38); fringe(B, [(-X - t, X + t, z1 - 0.13)]); B.add('head', -0.11, 0.0, z1 + t, 0.11, 0.22, z1 + t + 0.2); mk('bun', B)
    return made

def build_block_outfits(coll, arm, J):
    M = {'top': bpy.data.materials['TINT_top'], 'bottom': bpy.data.materials['TINT_bottom'], 'shoes': bpy.data.materials['TINT_shoes'],
         'sole': bpy.data.materials['FIX_sole'], 'detail': bpy.data.materials['FIX_detail']}
    e = 0.018; made = []
    def torso(B, ee=e, low=0.70):   # 상체 옷(아래 끝 low)
        hx = 0.25 + ee
        B.add('hips', -hx, -0.14 - ee, low, hx, 0.14 + ee, 0.82); B.add('spine', -hx, -0.14 - ee, 0.82, hx, 0.14 + ee, 0.99); B.add('chest', -hx, -0.145 - ee, 0.99, hx, 0.145 + ee, 1.185)
    def arms(B, full, ee=e):
        for s in 'LR':
            limb_box(B, 'upper_arm.' + s, J['shoulder.' + s] + Vector((0, 0, 0.05 + ee)), J['elbow.' + s], 0.17, 0.18, ee, 0.0, 1.0 if full else 0.55)
            if full: limb_box(B, 'lower_arm.' + s, J['elbow.' + s], J['wrist.' + s], 0.16, 0.17, ee, 0.0, 0.92)
    def mk(name, kind, typ, B, m): made.append(part(B, name, coll, arm, M[m], kind, typ).name)
    B = Boxes(); torso(B); arms(B, False); mk('block_TOP_tee', 'top', 'tee', B, 'top')
    B = Boxes(); torso(B); arms(B, True); mk('block_TOP_long', 'top', 'long', B, 'top')
    B = Boxes(); torso(B, 0.026, 0.68); arms(B, True, 0.026); mk('block_TOP_hoodie', 'top', 'hoodie', B, 'top')
    B = Boxes(); B.add('chest', -0.2, 0.12, 1.12, 0.2, 0.26, 1.3); mk('block_TOP_hoodie_hood', 'top', 'hoodie', B, 'top')
    B = Boxes(); B.add('chest', -0.07, -0.18, 1.0, -0.05, -0.16, 1.13); B.add('chest', 0.05, -0.18, 1.0, 0.07, -0.16, 1.13); mk('block_TOP_hoodie_strings', 'top', 'hoodie', B, 'detail')
    B = Boxes(); torso(B); arms(B, False); mk('block_TOP_shirt', 'top', 'shirt', B, 'top')
    B = Boxes(); B.add('chest', -0.17, -0.18, 1.14, 0.17, 0.17, 1.2); B.add('chest', -0.015, -0.175, 0.74, 0.015, -0.16, 1.14); mk('block_TOP_shirt_collar', 'top', 'shirt', B, 'detail')
    B = Boxes(); torso(B, e, 0.78); mk('block_TOP_dress', 'top', 'dress', B, 'top')
    B = Boxes()
    for k, (zt, zb, w) in enumerate(((0.80, 0.66, 0.29), (0.66, 0.54, 0.32), (0.54, 0.42, 0.35))): B.add('hips', -w, -0.17 - k * 0.02, zb, w, 0.17 + k * 0.02, zt)   # 계단처럼 퍼지는 치마
    mk('block_TOP_dress_skirt', 'top', 'dress', B, 'top')
    # 하의
    def legs(B, t_upper=1.0, lower=True):
        hx = 0.25 + e * 0.6; B.add('hips', -hx, -0.14 - e * 0.6, 0.66, hx, 0.14 + e * 0.6, 0.78)
        for s in 'LR':
            limb_box(B, 'upper_leg.' + s, J['hip.' + s], J['knee.' + s], 0.21, 0.22, e * 0.6, 0.0, t_upper)
            if lower: limb_box(B, 'lower_leg.' + s, J['knee.' + s], J['ankle.' + s], 0.2, 0.21, e * 0.6, 0.0, 0.85)
    B = Boxes(); legs(B); mk('block_BOTTOM_pants', 'bottom', 'pants', B, 'bottom')
    B = Boxes(); legs(B, 0.6, False); mk('block_BOTTOM_shorts', 'bottom', 'shorts', B, 'bottom')
    B = Boxes()
    for k, (zt, zb, w) in enumerate(((0.80, 0.68, 0.28), (0.68, 0.56, 0.31), (0.56, 0.47, 0.33))): B.add('hips', -w, -0.17 - k * 0.02, zb, w, 0.17 + k * 0.02, zt)
    mk('block_BOTTOM_skirt', 'bottom', 'skirt', B, 'bottom')
    # 신발
    B = Boxes(); B2 = Boxes()
    for s in 'LR':
        a = J['ankle.' + s]; B.add('foot.' + s, a.x - 0.11, -0.185, 0.03, a.x + 0.11, 0.115, 0.14); B.add('lower_leg.' + s, a.x - 0.11, -0.115, 0.12, a.x + 0.11, 0.115, 0.19)
        B2.add('foot.' + s, a.x - 0.115, -0.19, 0.0, a.x + 0.115, 0.12, 0.035)
    mk('block_SHOES_sneakers', 'shoes', 'sneakers', B, 'shoes'); mk('block_SHOES_sneakers_sole', 'shoes', 'sneakers', B2, 'sole')
    B = Boxes()
    for s in 'LR':
        a = J['ankle.' + s]; B.add('foot.' + s, a.x - 0.115, -0.19, 0.0, a.x + 0.115, 0.12, 0.15); B.add('lower_leg.' + s, a.x - 0.115, -0.12, 0.12, a.x + 0.115, 0.12, 0.34)
    mk('block_SHOES_boots', 'shoes', 'boots', B, 'shoes')
    return made

def build_block_accessories(coll, arm):
    M = {'acc': bpy.data.materials['TINT_acc'], 'gold': bpy.data.materials['FIX_gold']}
    X, Y, z0, z1 = HEAD['hx'], HEAD['hy'], HEAD['z0'], HEAD['z1']; cz = (z0 + z1) / 2; made = []
    ex = (17 / FACE_SPAN) * X; ez = cz + (-6 / FACE_SPAN) * (z1 - z0) / 2      # 눈 위치(얼굴 텍스처와 맞춤)
    def mk(typ, B, m='acc'): made.append(part(B, 'block_ACC_' + typ, coll, arm, M[m], 'acc', typ, keys=False).name)
    B = Boxes(); fy0, fy1, w, h, th = -Y - 0.035, -Y - 0.015, 0.1, 0.085, 0.016
    for sx in (-1, 1):
        x = sx * ex
        B.add('head', x - w, fy0, ez + h - th, x + w, fy1, ez + h); B.add('head', x - w, fy0, ez - h, x + w, fy1, ez - h + th)
        B.add('head', x - w, fy0, ez - h, x - w + th, fy1, ez + h); B.add('head', x + w - th, fy0, ez - h, x + w, fy1, ez + h)
        B.add('head', sx * (X + 0.005), -Y - 0.03, ez + h - th, sx * (X + 0.02), Y * 0.4, ez + h)          # 다리(귀 쪽으로)
    B.add('head', -ex + w, fy0, ez + h * 0.3, ex - w, fy1, ez + h * 0.3 + th); mk('glasses', B)
    B = Boxes(); B.add('head', -X - 0.06, -Y - 0.06, z1 - 0.16, X + 0.06, Y + 0.06, z1 + 0.1); B.add('head', -X + 0.02, -Y - 0.24, z1 - 0.17, X - 0.02, -Y - 0.06, z1 - 0.13); mk('cap', B)
    B = Boxes(); B.add('head', -X - 0.07, -Y - 0.07, z1 - 0.22, X + 0.07, Y + 0.07, z1 + 0.14); B.add('head', -X - 0.08, -Y - 0.08, z1 - 0.26, X + 0.08, Y + 0.08, z1 - 0.18)
    B.add('head', -0.05, -0.05, z1 + 0.14, 0.05, 0.05, z1 + 0.22); mk('beanie', B)
    B = Boxes()
    for sx in (-1, 1): B.add('head', sx * X - 0.02 if sx > 0 else -X - 0.03, -0.03, cz - 0.17, sx * X + 0.03 if sx > 0 else -X + 0.02, 0.03, cz - 0.11)
    mk('earrings', B, 'gold')
    B = Boxes()   # 크로스백: 대각선 끈(작은 상자 계단) + 왼쪽 엉덩이 가방
    for k in range(9):
        t = k / 8; x = -0.22 + 0.44 * t; z = 1.16 - 0.42 * t
        bone = 'chest' if z > 0.99 else 'spine'
        B.add(bone, x - 0.03, -0.175, z - 0.03, x + 0.03, -0.155, z + 0.03); B.add(bone, -x - 0.03, 0.155, z - 0.03, -x + 0.03, 0.175, z + 0.03)
    B.add('hips', 0.2, -0.2, 0.62, 0.36, -0.08, 0.76); mk('crossbag', B)
    return made


def build_block_reward_accessories(coll, arm):
    gold = bpy.data.materials['FIX_gold']; gem = bpy.data.materials['FIX_gem']; X, Y, z1 = HEAD['hx'], HEAD['hy'], HEAD['z1']; made = []
    B = Boxes(); t = 0.035; h = 0.1; zb = z1 + 0.04   # 네모 왕관: 띠 + 모서리·가운데 뾰족
    B.add('head', -X + 0.04, -Y + 0.04, zb, X - 0.04, -Y + 0.04 + t, zb + h); B.add('head', -X + 0.04, Y - 0.04 - t, zb, X - 0.04, Y - 0.04, zb + h)
    B.add('head', -X + 0.04, -Y + 0.04, zb, -X + 0.04 + t, Y - 0.04, zb + h); B.add('head', X - 0.04 - t, -Y + 0.04, zb, X - 0.04, Y - 0.04, zb + h)
    for x in (-X + 0.04, -0.02, X - 0.04 - 0.04):
        for y in (-Y + 0.04, Y - 0.04 - t): B.add('head', x, y, zb + h, x + 0.04, y + t, zb + h + 0.07)
    o = part(B, 'block_ACC_crown', coll, arm, gold, 'acc', 'crown', keys=False); made.append(o.name)
    G = Boxes(); G.add('head', -0.03, -Y + 0.02, zb + 0.03, 0.03, -Y + 0.045, zb + 0.08); made.append(part(G, 'block_ACC_crown_gem', coll, arm, gem, 'acc', 'crown', keys=False).name)
    K = Boxes(); x = -0.27; z = 0.74   # 오른쪽 허리춤 네모 고리 + 열쇠
    K.add('hips', x - 0.012, -0.11, z - 0.01, x, -0.02, z + 0.012); K.add('hips', x - 0.012, -0.11, z - 0.1, x, -0.02, z - 0.088)
    K.add('hips', x - 0.012, -0.11, z - 0.1, x, -0.098, z + 0.012); K.add('hips', x - 0.012, -0.032, z - 0.1, x, -0.02, z + 0.012)
    K.add('hips', x - 0.012, -0.075, z - 0.24, x, -0.055, z - 0.1); K.add('hips', x - 0.012, -0.1, z - 0.22, x, -0.055, z - 0.2)
    made.append(part(K, 'block_ACC_goldkeyring', coll, arm, gold, 'acc', 'goldkeyring').name)
    return made
