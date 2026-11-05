# 키링 월드 블록 스타일 — kl_helpers.py 다음에 exec로 실행.
# 텍스처: plaza-blender/textures/blocky/*.png (16×16 = 1m 한 칸, make_block_textures.py로 만듦)
# 원칙: 기존 오브젝트 이름·위치는 그대로 두고(웹이 이름으로 장애물을 찾음) 메시만 블록 모양으로 바꾼다.
import bpy, bmesh, math
from mathutils import Vector, Matrix

TEX = '/Users/lifetae2021/Desktop/keylink/plaza-blender/textures/blocky/'

def tex_mat(name, png, rough=0.9):
    """픽셀 텍스처 재질(가장 가까운 픽셀로 보이게 Closest → glTF NEAREST)."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(TEX + png, check_existing=True); t.interpolation = 'Closest'
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    b.inputs['Roughness'].default_value = rough
    return m

def box_uv(bm, tiles_per_m=1.0):
    """면 방향(가장 큰 법선 축)에 따라 월드 좌표로 UV — 블록 한 칸(1m)에 텍스처 한 장."""
    uv = bm.loops.layers.uv.verify(); bm.normal_update()
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co
            if ax == 2: u, v = c.x, c.y
            elif ax == 0: u, v = c.y, c.z
            else: u, v = c.x, c.z
            l[uv].uv = (u * tiles_per_m, v * tiles_per_m)

def replace_mesh(o, bm_world, mats, top_side=None, frame=None, mat_fn=None):
    """bmesh를 오브젝트 o의 메시로 바꿔 넣는다(위치·부모 유지). bm은 frame 좌표계(기본: 월드)로 만든 것.
    UV는 frame 기준으로 계산(돌아간 집도 텍스처가 반듯하게). top_side=(위, 옆) 재질 번호 또는 mat_fn(면)→번호."""
    box_uv(bm_world)
    if top_side:
        for f in bm_world.faces: f.material_index = top_side[0] if f.normal.z > 0.5 else top_side[1]
    if mat_fn:
        for f in bm_world.faces: f.material_index = mat_fn(f)
    F = frame if frame is not None else Matrix.Identity(4)
    bmesh.ops.transform(bm_world, matrix=o.matrix_world.inverted() @ F, verts=bm_world.verts)
    me = o.data; me.materials.clear()
    for m in mats: me.materials.append(m)
    bm_world.to_mesh(me); bm_world.free()
    for p in me.polygons: p.use_smooth = False
    me.update(); return o

def world_bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))

def cube(bm, x0, y0, z0, x1, y1, z1):
    """축에 맞춘 상자 하나를 bm에 추가."""
    b = bm_box(x1 - x0, y1 - y0, z1 - z0); bmesh.ops.translate(b, vec=((x0 + x1) / 2, (y0 + y1) / 2, z0), verts=b.verts)
    me = bpy.data.meshes.new('_c'); b.to_mesh(me); bm.from_mesh(me); b.free(); bpy.data.meshes.remove(me)

def voxel_slab(cells, z0, z1, size=1.0, top=True, bottom=False, below=None):
    """칸 집합(정수 i,j) → 바깥 옆면 + 윗면(top) + 아랫면(bottom, below에 없는 칸만 = 아래층보다 튀어나온 부분)만 있는 블록 판."""
    bm = bmesh.new(); vcache = {}
    def V(x, y, z):
        k = (round(x, 4), round(y, 4), round(z, 4))
        if k not in vcache: vcache[k] = bm.verts.new(k)
        return vcache[k]
    s = size
    for (i, j) in cells:
        x0, y0, x1, y1 = i * s, j * s, (i + 1) * s, (j + 1) * s
        if top: bm.faces.new((V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)))
        if bottom and not (below and (i, j) in below): bm.faces.new((V(x0, y1, z0), V(x1, y1, z0), V(x1, y0, z0), V(x0, y0, z0)))
        if (i - 1, j) not in cells: bm.faces.new((V(x0, y1, z0), V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1)))
        if (i + 1, j) not in cells: bm.faces.new((V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1)))
        if (i, j - 1) not in cells: bm.faces.new((V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)))
        if (i, j + 1) not in cells: bm.faces.new((V(x1, y1, z0), V(x0, y1, z0), V(x0, y1, z1), V(x1, y1, z1)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def disc_cells(cx, cy, rx, ry, size=1.0):
    out = set()
    for i in range(int((cx - rx) // size) - 1, int((cx + rx) // size) + 2):
        for j in range(int((cy - ry) // size) - 1, int((cy + ry) // size) + 2):
            x, y = (i + 0.5) * size, (j + 0.5) * size
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0: out.add((i, j))
    return out

# ── 앉는 자리 표시점: SEAT_* (kl_role=seat, kl_h=앉는 면 높이). 앉은 사람은 표시점의 로컬 -Y 쪽을 본다 ──
def seat(name, frame, lx, ly, top, face_rot=0.0, coll_name='VILLAGE_props'):
    """frame(부모 기준 행렬) 안의 (lx, ly) 자리, 앉는 면 높이 top(m). face_rot: 로컬 -Y에서 더 돌릴 각도."""
    C = bpy.data.collections[coll_name]; drop(name)
    o = bpy.data.objects.new(name, None); o.empty_display_type = 'SINGLE_ARROW'; o.empty_display_size = 0.4; C.objects.link(o)
    o.matrix_world = frame @ Matrix.Translation((lx, ly, 0)) @ Matrix.Rotation(face_rot, 4, 'Z')
    o['kl_role'] = 'seat'; o['kl_h'] = round(top, 3)
    return o
