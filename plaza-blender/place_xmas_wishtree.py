# 크리스마스 맵 소원 트리를 실사 전나무로 바꾸기 — build_xmas_map.py 다음에, kl_helpers.py와 함께 exec.
# Higgsfield tripo_3d로 만든 장식 없는 전나무(gen/xmas_wishtree_*.glb)를 KL_Xmas 장면에 bl_import_model로 불러온 뒤 실행.
# - 크기: 높이 TREE_H m, 밑동을 원점(소원 트리 자리 = 웹 shop.js FOUNTAIN)에
# - 나무 실제 모양을 높이별로 재서(반지름 윤곽) 그 표면에 빛나는 전구 줄·장식 구슬을 다시 달고 꼭대기 별을 올린다
# - 예전 원뿔 트리(잎·눈·줄기·장식·전구)는 지운다. 울타리·랜턴·선물 상자는 그대로
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix

TREE_H = 12.4
# 2026-11-08: 장면에서 트리·장식·전구·별을 원점 기준 1.3배(높이 16.1m)로 키우고, 울타리는 둘레만 1.3배·등불/선물은 자리만 바깥으로 옮겼다(COL_wishtree 5.59).
# 다시 만들 때는 그 작업을 이 스크립트 뒤에 한 번 더 해야 웹(index.html TREE_K=1.3)과 맞는다.
OUT = '/Users/lifetae2021/Desktop/keylink/plaza-blender/gen/'
rng = random.Random(1224)
sc = bpy.data.scenes['KL_Xmas']
PROPS = bpy.data.collections['XMAS_props']

src = bpy.data.objects.get('XMAS_wishtree_real') or next(o for o in sc.objects if o.name.startswith('tripo_node_') and o.type == 'MESH')
me = src.data
if not src.get('kl_normalized'):
    zs = [v.co.z for v in me.vertices]; zmin, zmax = min(zs), max(zs)
    low = [v.co for v in me.vertices if v.co.z < zmin + (zmax - zmin) * 0.03]
    cx = sum(c.x for c in low) / len(low); cy = sum(c.y for c in low) / len(low)
    s = TREE_H / (zmax - zmin)
    me.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -zmin)))
    src['kl_normalized'] = 1
src.matrix_world = Matrix.Identity(4)
src.name = 'XMAS_wishtree_real'; me.name = 'XMAS_wishtree_real_mesh'
for c in list(src.users_collection): c.objects.unlink(src)
PROPS.objects.link(src)
src['kl_theme'] = 'xmas'

# 텍스처: 웹용 2048 JPEG, 금속 0·무광(어두운 밤 장면에서 번들거리지 않게)
mat_ = src.material_slots[0].material; mat_.name = 'XM_wishtree_real'
nt = mat_.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
for sock in ('Metallic', 'Roughness'):
    for l in list(bsdf.inputs[sock].links): nt.links.remove(l)
bsdf.inputs['Metallic'].default_value = 0.0; bsdf.inputs['Roughness'].default_value = 0.85
for n in list(nt.nodes):
    if n.type != 'TEX_IMAGE' or not n.image: continue
    img = n.image; nm = img.name.lower()
    if nm.startswith('orm'): nt.nodes.remove(n); continue
    kind = 'color' if nm.startswith('color') else 'normal' if nm.startswith('normal') else None
    if not kind: continue
    if img.size[0] > 2048: img.scale(2048, 2048)
    path = OUT + f'xmas_wishtree_{kind}.jpg'
    img.filepath_raw = path; img.file_format = 'JPEG'; sc.render.image_settings.quality = 88; img.save()
    if img.packed_file: img.unpack(method='REMOVE')
    img.filepath = path; img.reload(); img.name = f'XM_wishtree_{kind}'

# 생성된 잎 색이 너무 어두워 밤 장면에서 검게 뭉쳐 보이므로 한 번만 밝게(초록은 조금 더 살림)
import numpy as np
col = bpy.data.images.get('XM_wishtree_color')
if col and not mat_.get('kl_brightened'):
    px = np.empty(col.size[0] * col.size[1] * 4, dtype=np.float32); col.pixels.foreach_get(px); px = px.reshape(-1, 4)
    rgb = np.clip((px[:, :3] ** 0.72) * 1.35, 0, 1); rgb[:, 1] = np.clip(rgb[:, 1] * 1.08, 0, 1)
    px[:, :3] = rgb; col.pixels.foreach_set(px.ravel()); col.save(); mat_['kl_brightened'] = 1

# 예전 원뿔 트리 지우기
for n in ('XMAS_wishtree_leaves', 'XMAS_wishtree_snow', 'XMAS_wishtree_trunk', 'XMAS_wishtree_lights_glow',
          'XMAS_wishtree_orn_o_red_glow', 'XMAS_wishtree_orn_gold_glow', 'XMAS_wishtree_orn_o_silver_glow', 'XMAS_wishtree_star_glow'):
    o = bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o, do_unlink=True)

# 높이별 반지름 윤곽(0.25m 칸마다 바깥 90% 지점 — 튀어나온 가지 끝 몇 개에 끌려가지 않게)
step = 0.25; nb = int(TREE_H / step) + 1; buckets = [[] for _ in range(nb)]
for v in me.vertices:
    i = min(nb - 1, max(0, int(v.co.z / step))); buckets[i].append(math.hypot(v.co.x, v.co.y))
prof = []
for b in buckets:
    b.sort(); prof.append(b[int(len(b) * 0.9)] if b else 0.0)
for _ in range(2): prof = [(prof[max(0, i - 1)] + prof[i] + prof[min(nb - 1, i + 1)]) / 3 for i in range(nb)]
def R(z): return prof[min(nb - 1, max(0, int(z / step)))]

M = {k: bpy.data.materials[n] for k, n in (('o_red', 'XM_orn_red_glow'), ('gold', 'XM_gold_glow'), ('o_silver', 'XM_orn_silver_glow'), ('b_gold', 'XM_bulb_gold_glow'))}
def put(name, bm, m, loc=(0, 0, 0), smooth=True, **props):
    o = obj_from_bm(name, bm, m, PROPS, loc)
    for p in o.data.polygons: p.use_smooth = smooth
    for k, v in props.items(): o[k] = v
    o['kl_theme'] = 'xmas'
    return o

# 장식 구슬: 가지 표면에 살짝 묻히게
orn = {'o_red': [], 'gold': [], 'o_silver': []}
z0 = 1.2
for _ in range(150):
    z = rng.uniform(z0, TREE_H * 0.9); r = R(z) * 0.95; a = rng.uniform(0, math.tau)
    if r < 0.2: continue
    b = bm_ball(rng.uniform(0.13, 0.22), 1, z0=0); bmesh.ops.translate(b, vec=(math.cos(a) * r, math.sin(a) * r, z), verts=b.verts)
    orn[rng.choice(list(orn))].append(b)
for k, bl in orn.items(): put(f'XMAS_wishtree_orn_{k}_glow', bm_merge(*bl), M[k])
# 전구 줄: 아래에서 위로 나선
lights = []; n_l = 320
for i in range(n_l):
    t = i / n_l; z = z0 + t * (TREE_H * 0.93 - z0); r = R(z) * 1.0 + 0.05; a = t * math.tau * 9
    b = bm_ball(0.065, 0, z0=0); bmesh.ops.translate(b, vec=(math.cos(a) * r, math.sin(a) * r, z), verts=b.verts); lights.append(b)
put('XMAS_wishtree_lights_glow', bm_merge(*lights), M['b_gold'])
# 꼭대기 별
sb = bmesh.new(); pts = []
for i in range(10):
    a = math.pi / 2 + i * math.pi / 5; rr = 0.8 if i % 2 == 0 else 0.34
    pts.append((math.cos(a) * rr, math.sin(a) * rr))
fr = [sb.verts.new((x, -0.12, y)) for x, y in pts]; bk = [sb.verts.new((x, 0.12, y)) for x, y in pts]
sb.faces.new(fr[::-1]); sb.faces.new(bk)
for i in range(10):
    j = (i + 1) % 10; sb.faces.new((fr[i], fr[j], bk[j], bk[i]))
bmesh.ops.recalc_face_normals(sb, faces=sb.faces)
put('XMAS_wishtree_star_glow', sb, M['gold'], loc=(0, 0, TREE_H + 0.55), smooth=False, kl_spin=0.5)

base_r = max(prof[:int(2.0 / step)])
result = {'faces': len(me.polygons), 'height': round(max(v.co.z for v in me.vertices), 2), 'base_radius': round(base_r, 2),
          'radius_at': {z: round(R(z), 2) for z in (1, 3, 6, 9, 11)}, 'ornaments': sum(len(v) for v in orn.values())}
