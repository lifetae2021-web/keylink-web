# 키링 월드 실사 나무 1그루 — kl_helpers.py 없이 단독 실행(bl_execute에서 exec).
# 분수대 근처 블록 나무(PRP_tree_10_*) 자리에 실제 나무 모양을 만든다.
# - 줄기/가지: 갈래가 나뉘는 가지 뼈대를 따라 굵기가 줄어드는 관(8각)으로 만들고 나무껍질 사진풍 텍스처를 입힌다.
# - 잎: 잎 뭉치 그림(알파)을 입힌 평면 카드 여러 장. 법선을 수관 바깥쪽으로 돌려 덩어리처럼 빛을 받게 한다.
# - 텍스처는 numpy로 직접 그려 textures/real/에 PNG로 저장한다(glTF는 절차적 노드를 못 옮김).
# 웹 충돌: 이름에 tree_ + trunk가 들어간 메시 크기로 장애물을 잡으므로 PRP_tree_10_trunk는 원줄기만 담는다.
# 원래 블록 나무는 지우지 않고 RETIRED 컬렉션으로 옮겨 숨긴다(되돌리기 가능).
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix

TREE = 10
TEX = '/Users/lifetae2021/Desktop/keylink/plaza-blender/textures/real/'
os.makedirs(TEX, exist_ok=True)
rng = random.Random(7)
nrng = np.random.default_rng(7)


# ── 텍스처 ──────────────────────────────────────────────
def save_png(name, rgba):
    h, w, _ = rgba.shape
    img = bpy.data.images.get(name)
    if img and (img.size[0] != w or img.size[1] != h):
        bpy.data.images.remove(img); img = None
    if not img:
        img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.flipud(rgba).astype(np.float32).ravel())
    img.filepath_raw = TEX + name + '.png'
    img.file_format = 'PNG'
    img.save()
    return img


def blur(a, rx, ry):
    # 가로·세로 상자 흐림(타일이 이어지게 감싸서)
    out = a.copy()
    for _ in range(2):
        if rx: out = sum(np.roll(out, k, axis=1) for k in range(-rx, rx + 1)) / (2 * rx + 1)
        if ry: out = sum(np.roll(out, k, axis=0) for k in range(-ry, ry + 1)) / (2 * ry + 1)
    return out


def norm01(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)


def make_bark(w=256, h=512):
    fib = norm01(blur(nrng.random((h, w)), 1, 18))            # 세로 결
    big = norm01(blur(nrng.random((h, w)), 10, 40))           # 큰 얼룩
    cr = norm01(blur(nrng.random((h, w)), 3, 30))             # 갈라진 틈
    crack = np.clip((cr - 0.62) * 6, 0, 1)
    v = 0.55 * fib + 0.45 * big
    v = v * (1 - 0.75 * crack)
    dark = np.array([0.16, 0.12, 0.09]); light = np.array([0.46, 0.39, 0.31])
    rgb = dark + (light - dark) * v[..., None]
    rgb += (nrng.random((h, w, 1)) - 0.5) * 0.03
    return np.dstack([np.clip(rgb, 0, 1), np.ones((h, w))])


def make_leaves(s=512):
    img = np.zeros((s, s, 4))
    yy, xx = np.mgrid[0:s, 0:s] / s
    # 잔가지 몇 줄(중심에서 바깥으로)
    for _ in range(7):
        a = rng.uniform(0, math.tau); L = rng.uniform(0.28, 0.44)
        for t in np.linspace(0, 1, 160):
            x = 0.5 + math.cos(a) * L * t; y = 0.5 + math.sin(a) * L * t
            r = (1 - t) * 0.006 + 0.002
            m = (xx - x) ** 2 + (yy - y) ** 2 < r * r
            img[m] = [0.25, 0.19, 0.13, 1]
    # 잎 — 바깥일수록 듬성듬성, 아래·왼쪽은 조금 어둡게(빛 방향)
    lobes = [rng.uniform(0.75, 1.0) for _ in range(9)]
    for _ in range(1100):
        a = rng.uniform(0, math.tau)
        k = a / math.tau * 9; i0 = int(k) % 9; edge = lobes[i0] + (lobes[(i0 + 1) % 9] - lobes[i0]) * (k - int(k))
        r = 0.45 * edge * math.sqrt(rng.random()) ** 0.7       # 가장자리가 울퉁불퉁한 잎 뭉치
        cx, cy = 0.5 + math.cos(a) * r, 0.5 + math.sin(a) * r
        ln = rng.uniform(0.026, 0.044); wd = ln * rng.uniform(0.36, 0.48)
        ang = a + rng.uniform(-0.9, 0.9)
        x0, x1 = int(max(0, (cx - ln) * s)), int(min(s, (cx + ln) * s) + 1)
        y0, y1 = int(max(0, (cy - ln) * s)), int(min(s, (cy + ln) * s) + 1)
        if x1 <= x0 or y1 <= y0: continue
        X = xx[y0:y1, x0:x1] - cx; Y = yy[y0:y1, x0:x1] - cy
        u = X * math.cos(ang) + Y * math.sin(ang); v = -X * math.sin(ang) + Y * math.cos(ang)
        # 끝이 뾰족한 잎 모양
        t = np.clip((u / ln + 1) / 2, 0, 1)
        half = wd * np.sin(math.pi * t) ** 0.8
        inside = (np.abs(u) < ln) & (np.abs(v) < half)
        if not inside.any(): continue
        g = rng.random()
        base = np.array([0.26, 0.44, 0.13]) * (1 - g) + np.array([0.52, 0.70, 0.25]) * g      # 밝은 블록 세상에 맞춰 밝게
        lightf = 0.78 + 0.32 * ((cx - 0.5) + (0.5 - cy) + 0.5)
        shade = lightf * (0.85 + 0.25 * (v / (wd + 1e-9) + 1) / 2)       # 잎 한쪽이 밝게
        vein = np.abs(v) < wd * 0.08
        col = np.clip(base[None, None, :] * shade[..., None], 0, 1)
        col[vein] *= 0.78
        patch = img[y0:y1, x0:x1]
        patch[inside, :3] = col[inside]
        patch[inside, 3] = 1.0
    return img


bark_img = save_png('RT_bark', make_bark())
leaf_img = save_png('RT_leaves', make_leaves())


# ── 재질 ────────────────────────────────────────────────
def image_mat(name, img, rough, alpha=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (100, 0)
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.location = (-300, 0); tex.image = img; tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    if alpha:
        rnd = nt.nodes.new('ShaderNodeMath'); rnd.operation = 'ROUND'; rnd.location = (-80, -200)   # glTF: alphaMode MASK
        nt.links.new(tex.outputs['Alpha'], rnd.inputs[0]); nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
        m.use_backface_culling = False
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'DITHERED'
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m


M_BARK = image_mat('RT_bark', bark_img, 0.92)
M_LEAF = image_mat('RT_leaves', leaf_img, 0.75, alpha=True)


# ── 가지 뼈대 ───────────────────────────────────────────
def rand_dir_around(axis, max_ang):
    axis = axis.normalized()
    ref = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0))
    t1 = axis.cross(ref).normalized(); t2 = axis.cross(t1)
    a = rng.uniform(0, math.tau); b = rng.uniform(max_ang * 0.6, max_ang)
    return (axis * math.cos(b) + (t1 * math.cos(a) + t2 * math.sin(a)) * math.sin(b)).normalized()


def chain(start, direction, length, r0, r1, n=6, wobble=0.12, up=0.0):
    pts = [start.copy()]; rads = [r0]; d = direction.normalized(); p = start.copy()
    for i in range(1, n + 1):
        d = (d + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * wobble + Vector((0, 0, up))).normalized()
        p = p + d * (length / n); pts.append(p.copy()); rads.append(r0 + (r1 - r0) * (i / n))
    return pts, rads


branches = []          # (pts, rads, level)
trunk_pts, trunk_rads = chain(Vector((0, 0, 0)), Vector((0.05, 0.02, 1)), 2.9, 0.24, 0.16, n=7, wobble=0.05)
trunk_rads[0] = 0.34; trunk_rads[1] = 0.26                   # 뿌리 쪽이 퍼짐
top = trunk_pts[-1]
tips = []
limb_dirs = [math.tau * k / 4 + rng.uniform(-0.35, 0.35) for k in range(4)]
for k, a in enumerate(limb_dirs):
    tilt = rng.uniform(0.55, 0.85)
    d = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
    start = trunk_pts[-2 if k % 2 else -1].copy()
    pts, rads = chain(start, d, rng.uniform(2.3, 2.9), 0.14, 0.05, n=6, wobble=0.10, up=0.06)
    branches.append((pts, rads, 1))
    for j in range(3):
        i = rng.randint(2, len(pts) - 2)
        sd = rand_dir_around(pts[i + 1] - pts[i], 0.9)
        spts, srads = chain(pts[i], sd, rng.uniform(1.0, 1.6), rads[i] * 0.55, 0.018, n=4, wobble=0.18, up=0.05)
        branches.append((spts, srads, 2)); tips.append(spts[-1]); tips.append(spts[len(spts) // 2])
    tips.append(pts[-1])
# 원줄기 끝을 위로 조금 더
pts, rads = chain(top, Vector((0, 0, 1)), 1.6, 0.13, 0.04, n=4, wobble=0.08)
branches.append((pts, rads, 1)); tips.append(pts[-1])


# ── 관 메시 ─────────────────────────────────────────────
def tube(bm, uv, pts, rads, sides=8, cap=False):
    rings = []; prev_n = None; vlen = 0.0
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if prev_n is None:
            ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
            prev_n = t.cross(ref).normalized()
        n = (prev_n - t * prev_n.dot(t)).normalized(); prev_n = n
        b = t.cross(n)
        if i: vlen += (pts[i] - pts[i - 1]).length
        ring = []
        for s in range(sides):
            a = math.tau * s / sides
            ring.append(bm.verts.new(p + (n * math.cos(a) + b * math.sin(a)) * rads[i]))
        rings.append((ring, vlen))
    urep = max(1, round(math.tau * rads[0] / 0.6))
    for (r0, v0), (r1, v1) in zip(rings, rings[1:]):
        for s in range(sides):
            s2 = (s + 1) % sides
            f = bm.faces.new((r0[s], r0[s2], r1[s2], r1[s]))
            us = [s / sides * urep, (s + 1) / sides * urep]
            for loop, (u, v) in zip(f.loops, [(us[0], v0), (us[1], v0), (us[1], v1), (us[0], v1)]):
                loop[uv].uv = (u, v / 1.2)
            f.smooth = True
    if cap:
        f = bm.faces.new(list(reversed(rings[-1][0])))


def mesh_obj(name, bm, mat, coll, loc):
    me = bpy.data.meshes.new(name + '_mesh'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); o.location = loc
    for m in (mat if isinstance(mat, list) else [mat]): me.materials.append(m)
    coll.objects.link(o)
    return o


# ── 원래 블록 나무 은퇴 ─────────────────────────────────
scene = bpy.data.scenes['Scene']
props = bpy.data.collections['VILLAGE_props']
retired = bpy.data.collections.get('RETIRED') or bpy.data.collections.new('RETIRED')
if retired.name not in scene.collection.children: scene.collection.children.link(retired)
base_loc = None
for part in ('trunk', 'canopy'):
    old = bpy.data.objects.get(f'PRP_tree_{TREE}_{part}')
    if old and old.get('kl_real_tree'):
        me_old = old.data; bpy.data.objects.remove(old)
        if me_old.users == 0: bpy.data.meshes.remove(me_old)            # 다시 실행할 때: 예전 실사 나무는 새로 만든다
    elif old:
        if base_loc is None: base_loc = old.matrix_world.translation.copy()
        for c in list(old.users_collection): c.objects.unlink(old)
        retired.objects.link(old); old.name = f'RETIRED_block_tree_{TREE}_{part}'
        old.hide_set(True); old.hide_render = True
if base_loc is None:
    o = bpy.data.objects.get(f'RETIRED_block_tree_{TREE}_trunk'); base_loc = o.matrix_world.translation.copy()
base_loc.z = 0.0
for l in bpy.context.view_layer.layer_collection.children:
    if l.collection == retired: l.exclude = True

# 원줄기
bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
tube(bm, uv, trunk_pts, trunk_rads, sides=10)
trunk = mesh_obj(f'PRP_tree_{TREE}_trunk', bm, M_BARK, props, base_loc)

# 가지 + 잎(한 오브젝트, 재질 2개)
bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
for pts, rads, lvl in branches:
    tube(bm, uv, pts, rads, sides=8 if lvl == 1 else 6)
for f in bm.faces: f.material_index = 0
crown_c = Vector((0, 0, 4.8)); crown_r = Vector((2.6, 2.6, 1.9))
centers = []
for t in tips:
    for _ in range(7): centers.append(t + Vector((rng.gauss(0, .45), rng.gauss(0, .45), rng.gauss(.15, .35))))   # 가지 끝마다 잎 뭉치
while len(centers) < 170:
    d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
    k = rng.uniform(0.55, 1.0)
    centers.append(crown_c + Vector((d.x * crown_r.x, d.y * crown_r.y, d.z * crown_r.z)) * k)
for c in centers:
    out = (c - crown_c); out = out.normalized() if out.length > 1e-3 else Vector((0, 0, 1))
    nrm = (out * 0.9 + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.35).normalized()   # 옆에서 선처럼 보이지 않게 바깥을 향함
    ref = Vector((0, 0, 1)) if abs(nrm.z) < 0.9 else Vector((1, 0, 0))
    a1 = nrm.cross(ref).normalized(); a2 = nrm.cross(a1)
    roll = rng.uniform(0, math.tau); ax = a1 * math.cos(roll) + a2 * math.sin(roll); ay = nrm.cross(ax)
    sz = rng.uniform(0.9, 1.4) / 2
    vs = [bm.verts.new(c + ax * sx * sz + ay * sy * sz) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs); f.material_index = 1; f.smooth = True
    for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): loop[uv].uv = (u, v)
canopy = mesh_obj(f'PRP_tree_{TREE}_canopy', bm, [M_BARK, M_LEAF], props, base_loc)

# 잎 카드 법선을 수관 바깥쪽으로(덩어리처럼 보이게)
me = canopy.data
normals = [cn.vector.copy() for cn in me.corner_normals]
for poly in me.polygons:
    if poly.material_index == 1:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            normals[li] = ((v - crown_c) * 0.8 + poly.normal * 0.2).normalized()
me.normals_split_custom_set(normals)

for o in (trunk, canopy):
    o['kl_real_tree'] = 1

result = {
    'trunk': [round(x, 2) for x in trunk.dimensions], 'canopy': [round(x, 2) for x in canopy.dimensions],
    'tris': sum(len(p.vertices) - 2 for p in trunk.data.polygons) + sum(len(p.vertices) - 2 for p in canopy.data.polygons),
    'leaf_cards': len(centers), 'loc': [round(x, 2) for x in base_loc],
}
