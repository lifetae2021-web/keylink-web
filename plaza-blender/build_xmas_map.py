# 키링 월드 크리스마스 테마 맵 "키링 겨울 마을" — kl_helpers.py 다음에 exec로 실행.
# 기본 하늘섬(Scene)과 완전히 별개인 장면 KL_Xmas에 만든다 → public/plaza/themes/xmas_map.glb 로 내보냄.
# 콘셉트: 설산에 둘러싸인 눈마을 광장 + 얼음 호수. 둥글고 부드러운 로우폴리, 늘 저녁~밤(웹 themes.js night).
# 웹 기존 기능과 맞추는 약속(웹 좌표 = (bx, bz, -by)):
#  - 소원 트리는 원점(웹 shop.js FOUNTAIN {x:0,z:0,r:5.5}) → 울타리 반지름 4.2, 그 바깥 띠에서 소원을 건다
#  - 시작 위치 웹 (0,0,13) = Blender (0,-13), 키키 웹 (2.6,0,8.2) = Blender (2.6,-8.2), 걸을 수 있는 반지름 32
#  - 밤에 빛나는 것은 이름 끝 _glow / _light(가로등은 이름에 lamp → 바닥 불빛 웅덩이)
#  - 집 몸통 이름에 cottage + _body → 웹이 충돌 반경을 잡는다. 나머지 충돌은 COL_* (kl_role=collider_circle, kl_block)
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise

rng = random.Random(1225)

# ── 장면 준비(다시 실행하면 KL_Xmas만 지우고 새로 만든다) ──
sc = bpy.data.scenes.get('KL_Xmas') or bpy.data.scenes.new('KL_Xmas')
bpy.context.window.scene = sc
for c in list(sc.collection.children):
    for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
    sc.collection.children.unlink(c)
    if not c.users: bpy.data.collections.remove(c)
def xcoll(name):
    # 반드시 KL_Xmas 장면에만 연결(기본 하늘섬 장면에 섞이지 않게)
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for s_ in bpy.data.scenes:
        if s_ is not sc and c.name in s_.collection.children: s_.collection.children.unlink(c)
    if c.name not in sc.collection.children: sc.collection.children.link(c)
    return c
ENV, PROPS, COLS = xcoll('XMAS_env'), xcoll('XMAS_props'), xcoll('XMAS_colliders')
# 재질 값을 바꿔도 반영되게 이전 XM_ 재질은 지우고 새로 만든다(mat()은 같은 이름이 있으면 그대로 돌려줌)
for m_ in list(bpy.data.materials):
    if m_.name.startswith('XM_'): bpy.data.materials.remove(m_)

# ── 재질 ──
M = dict(
    snow=mat('XM_snow', (0.86, 0.90, 0.98), 0.75), path=mat('XM_path', (0.66, 0.70, 0.80), 0.85),
    plaza=mat('XM_plaza', (0.70, 0.66, 0.66), 0.8), ice=mat('XM_ice', (0.62, 0.80, 0.93), 0.08, 0.1),
    rock=mat('XM_rock', (0.30, 0.33, 0.42), 0.9), pine=mat('XM_pine', (0.06, 0.22, 0.17), 0.85),
    pine2=mat('XM_pine2', (0.05, 0.17, 0.13), 0.85), bark=mat('XM_bark', (0.24, 0.14, 0.08), 0.9),
    wood=mat('XM_wood', (0.34, 0.19, 0.10), 0.85), wood_dk=mat('XM_wood_dark', (0.20, 0.11, 0.06), 0.85),
    window=mat('XM_window_glow', (1.0, 0.62, 0.28), 0.5, emit=(1.0, 0.55, 0.2), emit_str=0.9),
    lamp=mat('XM_lamp_glow', (1.0, 0.7, 0.38), 0.5, emit=(1.0, 0.62, 0.28), emit_str=1.0),
    metal=mat('XM_metal', (0.12, 0.12, 0.14), 0.5, 0.6),
    red=mat('XM_red', (0.75, 0.06, 0.08), 0.5), cream=mat('XM_cream', (0.95, 0.90, 0.80), 0.7),
    green=mat('XM_green', (0.10, 0.45, 0.25), 0.6),
    gold=mat('XM_gold_glow', (1.0, 0.72, 0.2), 0.3, 0.4, emit=(1.0, 0.65, 0.15), emit_str=1.0),
    b_red=mat('XM_bulb_red_glow', (1.0, 0.2, 0.2), 0.4, emit=(1.0, 0.15, 0.15), emit_str=1.2),
    b_gold=mat('XM_bulb_gold_glow', (1.0, 0.8, 0.4), 0.4, emit=(1.0, 0.7, 0.3), emit_str=1.2),
    b_green=mat('XM_bulb_green_glow', (0.3, 1.0, 0.4), 0.4, emit=(0.25, 1.0, 0.35), emit_str=1.2),
    b_blue=mat('XM_bulb_blue_glow', (0.35, 0.6, 1.0), 0.4, emit=(0.3, 0.55, 1.0), emit_str=1.2),
    o_red=mat('XM_orn_red_glow', (0.85, 0.08, 0.12), 0.25, 0.3, emit=(0.8, 0.05, 0.1), emit_str=0.8),
    o_silver=mat('XM_orn_silver_glow', (0.85, 0.88, 0.95), 0.2, 0.6, emit=(0.6, 0.7, 1.0), emit_str=0.6),
    coal=mat('XM_coal', (0.04, 0.04, 0.05), 0.9), carrot=mat('XM_carrot', (0.95, 0.42, 0.08), 0.7),
    scarf=mat('XM_scarf', (0.75, 0.10, 0.16), 0.8), scarf2=mat('XM_scarf2', (0.15, 0.35, 0.75), 0.8),
)


def soft(o, w=0.06, seg=2):
    """둥글고 부드럽게(모서리 깎기 — 내보낼 때 적용됨)."""
    m = o.modifiers.new('Soft', 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = 'ANGLE'
    return o


def put(name, bm, m, coll=PROPS, loc=(0, 0, 0), smooth=False, **props):
    o = obj_from_bm(name, bm, m, coll, loc)
    for p in o.data.polygons: p.use_smooth = smooth
    for k, v in props.items(): o[k] = v
    return o


def col(name, x, y, r):
    empty(name, COLS, (x, y, 0), kl_role='collider_circle', kl_block=r)


def bm_cone(r, h, z0=0.0, seg=8, rot=0.0):
    b = bm_cyl(r, 0.0, h, seg, z0)
    if rot: bm_xform(b, rot=(0, 0, rot))
    return b


def at(b, x, y, z=0.0, rz=0.0):
    return bm_xform(b, loc=(x, y, z), rot=(0, 0, rz))


# ── 땅: 가운데는 평평한 눈밭, 바깥은 부드럽게 솟는 언덕 ──
g = bmesh.new()
bmesh.ops.create_grid(g, x_segments=90, y_segments=90, size=85)
for v in g.verts:
    r = math.hypot(v.co.x, v.co.y)
    n = noise.noise(Vector((v.co.x * 0.045, v.co.y * 0.045, 0.3)))
    h = 0.0
    if r > 36: h = ((r - 36) ** 1.35) * 0.16 + (n * 0.5 + 0.5) * min(1, (r - 36) / 12) * 3.5
    v.co.z = h - 0.02
put('ENV_snow_ground', g, M['snow'], ENV)

# 썰매 언덕(남서쪽 바깥)
hill = bm_ball(1.0, 3, z0=0)
for v in hill.verts: v.co.z = max(v.co.z, 0.0)
bm_xform(hill, scale=(15, 12, 8)); at(hill, -40, -33, -0.5)
put('ENV_sled_hill', hill, M['snow'], ENV, smooth=True)

# 광장(원형 돌바닥)과 길(다져진 눈)
put('ENV_plaza_stone', bm_cyl(10.5, 10.5, 0.06, 48, 0.0), M['plaza'], ENV)
paths = [bm_xform(bm_box(3.2, 22, 0.04), loc=(0, -21, 0.0)),            # 남쪽 입구 → 광장
         bm_xform(bm_box(20, 3.6, 0.04), loc=(20, 0, 0.0)),              # 광장 → 마켓 거리(동)
         bm_xform(bm_box(18, 3.0, 0.04), loc=(-19, -1, 0.0)),            # 광장 → 통나무집(서)
         bm_xform(bm_box(2.8, 6, 0.04), loc=(0, 12.5, 0.0))]             # 광장 → 호수(북)
put('ENV_paths', bm_merge(*paths), M['path'], ENV)

# ── 얼음 호수(북쪽) + 눈 둑 ──
LX, LY, LRX, LRY = 0.0, 22.0, 12.0, 7.5
ice = bm_cyl(1.0, 1.0, 0.05, 64, 0.0); bm_xform(ice, scale=(LRX, LRY, 1)); at(ice, LX, LY, 0.01)
put('ENV_lake_ice', ice, M['ice'], ENV)
bank = bm_torus(1.0, 0.09, 64, 8); bm_xform(bank, scale=(LRX + 0.5, LRY + 0.5, 3.2)); at(bank, LX, LY, 0.15)
put('ENV_lake_bank', bank, M['snow'], ENV, smooth=True)


def in_lake(x, y, pad=1.5):
    return ((x - LX) / (LRX + pad)) ** 2 + ((y - LY) / (LRY + pad)) ** 2 < 1


# ── 거대한 소원 트리(원점) ──
T_TIERS = [(4.4, 3.4, 1.0), (3.6, 3.0, 3.4), (2.9, 2.7, 5.6), (2.2, 2.4, 7.6), (1.5, 2.1, 9.3), (0.9, 1.8, 10.8)]
tree_g, tree_s = [], []
for i, (R, H, Z) in enumerate(T_TIERS):
    tree_g.append(bm_cone(R, H, Z, 14, rot=i * 0.4))
    f = 0.55
    tree_s.append(bm_cone(R * (1 - f) * 1.1, H * (1 - f) * 1.05, Z + H * f, 14, rot=i * 0.4))
put('XMAS_wishtree_leaves', bm_merge(*tree_g), M['pine'])
put('XMAS_wishtree_snow', bm_merge(*tree_s), M['snow'])
put('XMAS_wishtree_trunk', bm_cyl(0.55, 0.45, 1.4, 10), M['bark'])
orn = {'o_red': [], 'gold': [], 'o_silver': []}
for (R, H, Z) in T_TIERS:
    for _ in range(int(R * 6)):
        f = rng.uniform(0.08, 0.5); a = rng.uniform(0, math.tau); r = R * (1 - f) + 0.08
        b = bm_ball(rng.uniform(0.14, 0.24), 1, z0=0); at(b, math.cos(a) * r, math.sin(a) * r, Z + f * H - 0.1)
        orn[rng.choice(list(orn))].append(b)
for k, bl in orn.items(): put(f'XMAS_wishtree_orn_{k}_glow', bm_merge(*bl), M[k], smooth=True)
lights = []
n_l = 260
for i in range(n_l):
    t = i / n_l; z = 1.3 + t * 11.0
    R = next((R * (1 - (z - Z) / H) for (R, H, Z) in reversed(T_TIERS) if Z <= z <= Z + H), 0.6)
    a = t * math.tau * 8; r = R + 0.12
    b = bm_ball(0.07, 0, z0=0); at(b, math.cos(a) * r, math.sin(a) * r, z); lights.append(b)
put('XMAS_wishtree_lights_glow', bm_merge(*lights), M['b_gold'], smooth=True)
# 꼭대기 별(세로로 선 5각 별, 천천히 돈다)
sb = bmesh.new(); pts = []
for i in range(10):
    a = math.pi / 2 + i * math.pi / 5; r = 0.85 if i % 2 == 0 else 0.36
    pts.append((math.cos(a) * r, math.sin(a) * r))
fr = [sb.verts.new((x, -0.12, y)) for x, y in pts]; bk = [sb.verts.new((x, 0.12, y)) for x, y in pts]
sb.faces.new(fr[::-1]); sb.faces.new(bk)
for i in range(10):
    j = (i + 1) % 10; sb.faces.new((fr[i], fr[j], bk[j], bk[i]))
bmesh.ops.recalc_face_normals(sb, faces=sb.faces)
put('XMAS_wishtree_star_glow', sb, M['gold'], loc=(0, 0, 13.4), kl_spin=0.5)
# 울타리(반지름 4.2) + 기둥 위 작은 랜턴
fence = []; flan = []
for i in range(24):
    a = i / 24 * math.tau; x, y = math.cos(a) * 4.2, math.sin(a) * 4.2
    fence.append(at(bm_box(0.16, 0.16, 0.9), x, y))
    if i % 4 == 0: flan.append(at(bm_box(0.22, 0.22, 0.26), x, y, 0.9))
rail = bm_torus(4.2, 0.05, 48, 6); at(rail, 0, 0, 0.72); fence.append(rail)
rail2 = bm_torus(4.2, 0.05, 48, 6); at(rail2, 0, 0, 0.38); fence.append(rail2)
soft(put('XMAS_wishtree_fence', bm_merge(*fence), M['wood']), 0.03)
put('XMAS_wishtree_lanterns_glow', bm_merge(*flan), M['lamp'])
col('COL_wishtree', 0, 0, 4.3)
# 트리 아래 선물 상자(울타리 안)
gifts = {'red': [], 'cream': [], 'green': []}; ribbons = []
for i in range(12):
    a = rng.uniform(0, math.tau); r = rng.uniform(1.6, 3.4); s = rng.uniform(0.45, 0.8); rz = rng.uniform(0, 1.5)
    x, y = math.cos(a) * r, math.sin(a) * r
    gifts[rng.choice(list(gifts))].append(at(bm_box(s, s, s * 0.85), x, y, 0.0, rz))
    ribbons.append(at(bm_merge(bm_box(s + 0.02, 0.09, s * 0.85 + 0.02), bm_box(0.09, s + 0.02, s * 0.85 + 0.02)), x, y, 0.0, rz))
for k, bl in gifts.items(): soft(put(f'XMAS_gifts_{k}', bm_merge(*bl), M[k]), 0.04)
put('XMAS_gift_ribbons', bm_merge(*ribbons), M['gold'])


# ── 소나무(눈 쌓인 3단 원뿔) ──
def pine(x, y, s):
    rz = rng.uniform(0, math.tau); gm, sm = [], []
    tr = at(bm_cyl(0.16 * s, 0.12 * s, 0.9 * s, 6), x, y)
    for i, (R, H, Z) in enumerate(((1.25, 1.7, 0.6), (0.95, 1.45, 1.6), (0.62, 1.2, 2.5))):
        gm.append(at(bm_cone(R * s, H * s, Z * s, 7, rot=rz + i), x, y))
        sm.append(at(bm_cone(R * s * 0.5, H * s * 0.52, (Z + H * 0.5) * s, 7, rot=rz + i), x, y))
    return tr, gm, sm


trunks, greens, greens2, snows = [], [], [], []
def add_pine(x, y, s, inner=False):
    tr, gm, sm = pine(x, y, s); trunks.append(tr); (greens if rng.random() < 0.6 else greens2).extend(gm); snows.extend(sm)
    if inner: col(f'COL_pine_{len(trunks)}', x, y, 0.55 * s + 0.2)


def free_spot(x, y):
    r = math.hypot(x, y)
    if r < 12.5: return False                                   # 광장
    if in_lake(x, y, 2.5): return False
    if 10 < x < 31 and -8 < y < 8: return False                  # 마켓 거리
    if -31 < x < -10 and -12 < y < 10: return False              # 통나무집 마을
    if abs(x) < 3.5 and y < -9: return False                      # 남쪽 길
    if abs(y) < 3.0 and abs(x) > 9: return False                  # 동서 길
    return True


placed = 0; tries = 0
while placed < 26 and tries < 3000:
    tries += 1; x, y = rng.uniform(-31, 31), rng.uniform(-31, 31)
    if math.hypot(x, y) > 30.5 or not free_spot(x, y): continue
    add_pine(x, y, rng.uniform(0.9, 1.5), inner=True); placed += 1
for i in range(260):
    a = rng.uniform(0, math.tau); r = rng.uniform(34.5, 66)
    add_pine(math.cos(a) * r, math.sin(a) * r, rng.uniform(1.2, 2.6))
put('XMAS_pines_trunks', bm_merge(*trunks), M['bark'])
put('XMAS_pines_a', bm_merge(*greens), M['pine'])
put('XMAS_pines_b', bm_merge(*greens2), M['pine2'])
put('XMAS_pines_snow', bm_merge(*snows), M['snow'])

# ── 멀리 설산 ──
rocks, caps = [], []
for i in range(11):
    a = i / 11 * math.tau + rng.uniform(-0.15, 0.15); r = rng.uniform(115, 150)
    R = rng.uniform(26, 42); H = rng.uniform(32, 60); x, y = math.cos(a) * r, math.sin(a) * r; rz = rng.uniform(0, 3)
    rocks.append(at(bm_cone(R, H, -2, 7, rot=rz), x, y))
    caps.append(at(bm_cone(R * 0.42, H * 0.43, -2 + H * 0.575, 7, rot=rz), x, y))
put('ENV_mountains', bm_merge(*rocks), M['rock'], ENV)
put('ENV_mountain_snow', bm_merge(*caps), M['snow'], ENV)


# ── 통나무집(서쪽 마을) ──
win_bms, bulb = [], {'b_red': [], 'b_gold': [], 'b_green': [], 'b_blue': []}
def cabin(i, x, y, rz, w=4.6, d=4.0, h=2.8):
    R = Matrix.Rotation(rz, 4, 'Z')
    def place(b): bmesh.ops.transform(b, matrix=R, verts=b.verts); bmesh.ops.translate(b, vec=(x, y, 0), verts=b.verts); return b
    soft(put(f'XMAS_cottage_{i}_body', place(bm_box(w, d, h)), M['wood']), 0.08)
    # 박공지붕(앞뒤로 기울어진 두 판) + 두꺼운 눈
    rf, sn = [], []
    for sgn in (1, -1):
        pl = bm_box(w + 0.7, d / 2 + 0.6, 0.18); bm_xform(pl, rot=(sgn * -0.62, 0, 0), loc=(0, sgn * (d / 4 + 0.05), h + 0.75)); rf.append(pl)
        s = bm_box(w + 0.8, d / 2 + 0.55, 0.32); bm_xform(s, rot=(sgn * -0.62, 0, 0), loc=(0, sgn * (d / 4 + 0.05), h + 0.97)); sn.append(s)
    gable = bmesh.new()
    for sx in (-w / 2, w / 2):
        vs = [gable.verts.new((sx, -d / 2, h)), gable.verts.new((sx, d / 2, h)), gable.verts.new((sx, 0, h + 1.45))]
        gable.faces.new(vs if sx < 0 else vs[::-1])
    rf.append(gable)
    put(f'XMAS_cottage_{i}_roof', place(bm_merge(*rf)), M['wood_dk'])
    soft(put(f'XMAS_cottage_{i}_roofsnow', place(bm_merge(*sn)), M['snow'], smooth=True), 0.12, 3)
    ch = bm_box(0.6, 0.6, 1.4); bm_xform(ch, loc=(w * 0.28, d * 0.18, h + 1.1))
    chs = bm_box(0.75, 0.75, 0.22); bm_xform(chs, loc=(w * 0.28, d * 0.18, h + 2.5))
    soft(put(f'XMAS_cottage_{i}_chimney', place(ch), M['plaza']), 0.04)
    soft(put(f'XMAS_cottage_{i}_chimneysnow', place(chs), M['snow'], smooth=True), 0.08, 2)
    # 앞(-y)쪽 창문 2개 + 문
    for wx in (-w * 0.28, w * 0.28):
        b = bm_box(0.8, 0.08, 0.7); bm_xform(b, loc=(wx, -d / 2 - 0.03, 1.5)); win_bms.append(place(b))
    door = bm_box(0.9, 0.1, 1.7); bm_xform(door, loc=(0, -d / 2 - 0.04, 0)); put(f'XMAS_cottage_{i}_door', place(door), M['wood_dk'])
    # 처마 전구
    for k, t in enumerate([j * 0.45 for j in range(-5, 6)]):
        b = bm_ball(0.07, 0, z0=0); bm_xform(b, loc=(t, -d / 2 - 0.62, h + 0.25)); bulb[['b_red', 'b_gold', 'b_green', 'b_blue'][k % 4]].append(place(b))


cabins = [(-15.5, -6.5, 0.15), (-24.0, -5.0, -0.1), (-19.0, 4.5, math.pi + 0.2), (-27.5, 4.0, math.pi - 0.15), (-13.0, 10.5, math.pi * 0.85), (13.5, 13.5, math.pi * 1.2)]
for i, (x, y, rz) in enumerate(cabins): cabin(i + 1, x, y, rz)
put('XMAS_windows_glow', bm_merge(*win_bms), M['window'])

# ── 크리스마스 마켓 노점(동쪽 거리 양옆) ──
stall_body, stall_roof, stall_snow, aw_r, aw_c, counters = [], [], [], [], [], []
def stall(x, y, face):
    R = Matrix.Rotation(face, 4, 'Z')
    def place(b): bmesh.ops.transform(b, matrix=R, verts=b.verts); bmesh.ops.translate(b, vec=(x, y, 0), verts=b.verts); return b
    stall_body.append(place(bm_box(2.6, 1.6, 1.0)))
    stall_body.append(place(bm_xform(bm_box(2.6, 0.12, 2.6), loc=(0, 0.75, 0))))
    for px in (-1.25, 1.25): stall_body.append(place(bm_xform(bm_box(0.12, 0.12, 2.6), loc=(px, -0.75, 0))))
    roof = bm_box(3.0, 2.2, 0.12); bm_xform(roof, rot=(0.3, 0, 0), loc=(0, 0.0, 2.75)); stall_roof.append(place(roof))
    s = bm_box(3.05, 2.1, 0.22); bm_xform(s, rot=(0.3, 0, 0), loc=(0, 0.05, 2.92)); stall_snow.append(place(s))
    for k in range(8):
        b = bm_box(0.37, 0.05, 0.4); bm_xform(b, loc=(-1.3 + k * 0.37 + 0.18, -1.07, 2.3)); (aw_r if k % 2 == 0 else aw_c).append(place(b))
        bb = bm_ball(0.065, 0, z0=0); bm_xform(bb, loc=(-1.3 + k * 0.37 + 0.18, -1.12, 2.08)); bulb[['b_red', 'b_gold', 'b_green', 'b_blue'][k % 4]].append(place(bb))
    counters.append(place(bm_xform(bm_box(2.2, 0.08, 0.5), loc=(0, -0.79, 0.45))))


for i, sx in enumerate((13.5, 17.5, 21.5, 25.5)):
    # 노점 앞(로컬 -y)이 가운데 거리(y=0)를 보게
    stall(sx, -4.4, math.pi); col(f'COL_stall_s{i}', sx, -4.4, 1.5)
    stall(sx, 4.4, 0.0); col(f'COL_stall_n{i}', sx, 4.4, 1.5)
soft(put('XMAS_stalls', bm_merge(*stall_body), M['wood']), 0.04)
put('XMAS_stall_roofs', bm_merge(*stall_roof), M['wood_dk'])
soft(put('XMAS_stall_snow', bm_merge(*stall_snow), M['snow'], smooth=True), 0.08, 2)
put('XMAS_stall_awning_red', bm_merge(*aw_r), M['red'])
put('XMAS_stall_awning_cream', bm_merge(*aw_c), M['cream'])
put('XMAS_stall_counter_glow', bm_merge(*counters), M['window'])
for k, bl in bulb.items(): put(f'XMAS_{k}_lights', bm_merge(*bl), M[k], smooth=True)

# ── 마을 입구 아치(남쪽) ──
arch = []
for sx in (-2.4, 2.4):
    for k in range(8):
        arch.append(at(bm_cyl(0.2, 0.2, 0.42, 10, k * 0.42), sx, -29))
put('XMAS_arch_posts_red', bm_merge(*[b for i, b in enumerate(arch) if i % 2 == 0]), M['red'])
put('XMAS_arch_posts_cream', bm_merge(*[b for i, b in enumerate(arch) if i % 2 == 1]), M['cream'])
beam = bm_box(5.6, 0.5, 0.5); at(beam, 0, -29, 3.36); soft(put('XMAS_arch_beam', beam, M['wood_dk']), 0.06)
abs_ = bm_box(5.8, 0.65, 0.22); at(abs_, 0, -29, 3.86); soft(put('XMAS_arch_snow', abs_, M['snow'], smooth=True), 0.1, 2)
ab = [at(bm_ball(0.08, 0, z0=0), -2.6 + i * 0.4, -29.3, 3.3) for i in range(14)]
put('XMAS_arch_lights_glow', bm_merge(*ab), M['b_gold'], smooth=True)
col('COL_arch_l', -2.4, -29, 0.35); col('COL_arch_r', 2.4, -29, 0.35)

# ── 가로등(이름에 lamp + _light → 밤에 켜지고 바닥에 불빛) ──
lamp_spots = [(2.6, -15), (-2.6, -19.5), (2.6, -25), (8.5, 3.0), (11.5, -3.0), (28.5, 2.5), (-9.5, -3.0), (-21.5, 1.5),
              (7.0, 17.0), (-7.0, 17.5), (12.5, 24.0), (-12.5, 24.5), (0, 30.5), (7.5, -7.5), (-7.5, -7.5)]
posts = []
for i, (x, y) in enumerate(lamp_spots):
    posts.append(at(bm_cyl(0.09, 0.07, 2.9, 8), x, y))
    posts.append(at(bm_box(0.4, 0.4, 0.1), x, y, 2.9))
    put(f'XMAS_lamp_{i + 1}_light', at(bm_box(0.32, 0.32, 0.42), x, y, 2.98), M['lamp'])
    posts.append(at(bm_cone(0.32, 0.3, 0, 4, rot=math.pi / 4), x, y, 3.4))
    col(f'COL_lamp_{i + 1}', x, y, 0.25)
put('XMAS_lamp_posts', bm_merge(*posts), M['metal'])


# ── 벤치 + 앉는 자리(SEAT_*: kl_role=seat, 로컬 -Y가 앉은 사람이 보는 쪽) ──
def bench(i, x, y, face):
    R = Matrix.Rotation(face - math.pi / 2, 4, 'Z')
    parts = [bm_box(1.8, 0.5, 0.08), bm_xform(bm_box(1.8, 0.08, 0.45), loc=(0, 0.25, 0.5))]
    for lx in (-0.75, 0.75): parts.append(bm_xform(bm_box(0.08, 0.45, 0.42), loc=(lx, 0, -0.42)))
    b = bm_merge(*parts); bmesh.ops.translate(b, vec=(0, 0, 0.42), verts=b.verts)
    bmesh.ops.transform(b, matrix=R, verts=b.verts); bmesh.ops.translate(b, vec=(x, y, 0), verts=b.verts)
    soft(put(f'XMAS_bench_{i}', b, M['wood']), 0.02)
    sn = bm_box(1.7, 0.42, 0.06); bmesh.ops.translate(sn, vec=(0, 0.02, 0.5), verts=sn.verts)
    bmesh.ops.transform(sn, matrix=R, verts=sn.verts); bmesh.ops.translate(sn, vec=(x, y, 0), verts=sn.verts)
    for k, off in enumerate((-0.45, 0.45)):
        dx, dy = math.cos(face - math.pi / 2) * off, math.sin(face - math.pi / 2) * off
        e = empty(f'SEAT_xmas_bench_{i}_{k + 1}', PROPS, (x + dx, y + dy, 0), kl_role='seat', kl_h=0.5)
        e.rotation_euler = (0, 0, face - math.pi / 2)   # 등받이(face 방향) 반대쪽을 보게 — 로컬 -Y = face + π
    col(f'COL_bench_{i}', x, y, 0.75)


benches = [(6.8, -6.8, math.radians(135)), (-6.8, -6.8, math.radians(45)), (8.2, 5.0, math.radians(210)), (-8.2, 5.0, math.radians(-30)),
           (-6.0, 15.0, math.radians(-60)), (6.0, 15.0, math.radians(240))]
for i, (x, y, f) in enumerate(benches): bench(i + 1, x, y, f)


# ── 눈사람 ──
def snowman(i, x, y, face, scarf):
    body = bm_merge(bm_ball(0.62, 2, z0=0.55), bm_ball(0.45, 2, z0=1.42), bm_ball(0.32, 2, z0=2.05))
    put(f'XMAS_snowman_{i}_body', at(body, x, y), M['snow'], smooth=True, kl_block=0.6)
    fx, fy = math.cos(face), math.sin(face); px, py = -fy, fx
    eyes = bm_merge(*[at(bm_ball(0.045, 1, z0=0), x + fx * 0.28 + px * o, y + fy * 0.28 + py * o, 2.13) for o in (-0.1, 0.1)])
    put(f'XMAS_snowman_{i}_eyes', eyes, M['coal'], smooth=True)
    nose = bm_cone(0.06, 0.3, 0, 8); bm_xform(nose, rot=(0, math.pi / 2, 0)); bm_xform(nose, rot=(0, 0, face), loc=(x + fx * 0.3, y + fy * 0.3, 2.03))
    put(f'XMAS_snowman_{i}_nose', nose, M['carrot'])
    sc_ = bm_torus(0.4, 0.08, 20, 6); at(sc_, x, y, 1.78); put(f'XMAS_snowman_{i}_scarf', sc_, M[scarf], smooth=True)
    hat = bm_merge(bm_cyl(0.36, 0.36, 0.05, 16, 2.3), bm_cyl(0.23, 0.23, 0.38, 16, 2.33)); at(hat, x, y)
    put(f'XMAS_snowman_{i}_hat', hat, M['coal'])


for i, (x, y, f, s) in enumerate([(-9.0, -11.0, math.radians(-60), 'scarf'), (10.0, -11.5, math.radians(-120), 'scarf2'),
                                   (14.5, 19.5, math.radians(-150), 'scarf'), (-22.0, -11.5, math.radians(30), 'scarf2')]):
    snowman(i + 1, x, y, f, s)

# 정리: 모든 오브젝트는 밤 테마용 표시를 붙인다
for o in sc.objects: o['kl_theme'] = 'xmas'
tris = 0
for o in sc.objects:
    if o.type == 'MESH': tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
result = {'objects': len(sc.objects), 'tris_before_bevel': tris, 'pines': len(trunks), 'cabins': len(cabins)}
