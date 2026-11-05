# 키링 월드 AI 생성 나무 1그루 배치 — bl_execute에서 exec.
# Higgsfield tripo_3d(텍스트→3D)로 만든 나무(gen/tree_tripo_0b7b37b2.glb, job 0b7b37b2-f4cc-4cbe-95a9-02e16f12f6d8)를
# 분수대 근처 블록 나무 PRP_tree_11_* 자리에 놓는다. 먼저 bl_import_model로 GLB를 불러온 뒤 실행.
# - 크기: 원본 1m → 높이 HEIGHT m, 원점은 줄기 밑동(땅 z=0)
# - 텍스처: 4K 3장 → 웹용으로 줄여 JPEG로 저장(색·법선 2048 — 가까이서도 또렷하게, ORM은 쓰지 않음)
# - 충돌: 이름에 trunk가 없으니 kl_block(반지름 m)으로 웹이 장애물을 만든다
# 원래 블록 나무는 RETIRED 컬렉션으로 옮겨 숨긴다(되돌리기 가능).
import bpy, os
from mathutils import Vector, Matrix

TREE = 11
HEIGHT = 6.8
NAME = f'PRP_tree_{TREE}_gen'
OUT = '/Users/lifetae2021/Desktop/keylink/plaza-blender/gen/'

scene = bpy.data.scenes['Scene']
props = bpy.data.collections['VILLAGE_props']
retired = bpy.data.collections.get('RETIRED') or bpy.data.collections.new('RETIRED')
if retired.name not in scene.collection.children: scene.collection.children.link(retired)

src = bpy.data.objects.get(NAME) or next(o for o in bpy.data.objects if o.name.startswith('tripo_node_') and o.type == 'MESH')

# 원래 블록 나무 은퇴(자리 기억)
base = None
for part in ('trunk', 'canopy'):
    old = bpy.data.objects.get(f'PRP_tree_{TREE}_{part}')
    if old:
        if base is None: base = old.matrix_world.translation.copy()
        for c in list(old.users_collection): c.objects.unlink(old)
        retired.objects.link(old); old.name = f'RETIRED_block_tree_{TREE}_{part}'
        old.hide_render = True
if base is None:
    base = bpy.data.objects[f'RETIRED_block_tree_{TREE}_trunk'].matrix_world.translation.copy()
base.z = 0.0

# 메시를 밑동 기준·목표 높이로(처음 한 번만 — 이미 맞춘 메시는 건너뜀)
me = src.data
if not src.get('kl_normalized'):
    zs = [v.co.z for v in me.vertices]; zmin, zmax = min(zs), max(zs)
    low = [v.co for v in me.vertices if v.co.z < zmin + (zmax - zmin) * 0.03]
    cx = sum(c.x for c in low) / len(low); cy = sum(c.y for c in low) / len(low)
    s = HEIGHT / (zmax - zmin)
    me.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -zmin)))
    src['kl_normalized'] = 1
src.matrix_world = Matrix.Translation(base)
src.name = NAME; me.name = NAME + '_mesh'
for c in list(src.users_collection): c.objects.unlink(src)
props.objects.link(src)
src['kl_block'] = 0.6

# 텍스처 줄이기
mat = src.material_slots[0].material; mat.name = 'GEN_tree_' + str(TREE)
sizes = {'Color': 2048, 'NormalGL': 2048, 'ORM': 512}
saved = {}
for n in mat.node_tree.nodes:
    if n.type != 'TEX_IMAGE' or not n.image: continue
    img = n.image
    kind = next((k for k in sizes if img.name.startswith(k)), None)
    if not kind: continue
    px = sizes[kind]
    if img.size[0] > px: img.scale(px, px)
    path = OUT + f'tree{TREE}_{kind.lower()}.jpg'
    img.filepath_raw = path; img.file_format = 'JPEG'
    scene.render.image_settings.quality = 88
    img.save()
    if img.packed_file: img.unpack(method='REMOVE')
    img.filepath = path; img.reload()
    img.name = f'GEN_tree{TREE}_{kind.lower()}'
    saved[kind] = [img.size[0], os.path.getsize(path)]

# 웹(밝은 블록 세상)에서 어둡게 보이지 않게: 금속 0·무광(ORM 연결 끊기), 색 텍스처 밝게(한 번만)
import numpy as np
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
for sock in ('Metallic', 'Roughness'):
    for l in list(bsdf.inputs[sock].links): nt.links.remove(l)
bsdf.inputs['Metallic'].default_value = 0.0
bsdf.inputs['Roughness'].default_value = 0.85
for n in list(nt.nodes):
    if n.type == 'TEX_IMAGE' and n.image and 'orm' in n.image.name.lower(): nt.nodes.remove(n)
col = bpy.data.images.get(f'GEN_tree{TREE}_color')
if col and not mat.get('kl_brightened'):
    a = np.empty(col.size[0] * col.size[1] * 4, dtype=np.float32); col.pixels.foreach_get(a); a = a.reshape(-1, 4)
    a[:, :3] = np.clip((a[:, :3] ** 0.8) * 1.2, 0, 1)
    col.pixels.foreach_set(a.ravel()); col.save()
    mat['kl_brightened'] = 1

result = {'name': src.name, 'dims': [round(v, 2) for v in src.dimensions], 'loc': [round(v, 2) for v in src.matrix_world.translation],
          'faces': len(me.polygons), 'textures': saved}
