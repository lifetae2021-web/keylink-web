# 키링 월드 Blender 작업용 공통 도구 (Higgsfield 브리지의 bl_execute에서 exec로 불러 씀)
# 좌표: Blender Z-up, 미터. 웹(three.js)에서는 (x, y위, z) = (bx, bz, -by)
import bpy, bmesh, math
from mathutils import Vector, Matrix

def mat(name, rgb, rough=0.8, metal=0.0, emit=None, emit_str=1.0):
    """이름 하나에 재질 하나(같은 역할은 재사용). Blender 5.2는 기본 노드가 없어서 직접 만든다."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*rgb, 1); bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1); bsdf.inputs['Emission Strength'].default_value = emit_str
    m.diffuse_color = (*rgb, 1)
    return m

def coll(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def drop(name):
    """같은 이름이 있으면 지우고 다시 만든다(여러 번 돌려도 중복 안 생기게)."""
    o = bpy.data.objects.get(name)
    if o:
        for ch in list(o.children_recursive): bpy.data.objects.remove(ch, do_unlink=True)
        bpy.data.objects.remove(o, do_unlink=True)

def obj_from_bm(name, bm, material, collection, loc=(0, 0, 0), parent=None):
    drop(name)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(material)
    o = bpy.data.objects.new(name, me); collection.objects.link(o)
    o.location = loc
    if parent: o.parent = parent
    return o

def empty(name, collection, loc=(0, 0, 0), parent=None, **props):
    drop(name)
    o = bpy.data.objects.new(name, None); o.empty_display_size = 0.5; collection.objects.link(o)
    o.location = loc
    if parent: o.parent = parent
    for k, v in props.items(): o[k] = v
    return o

# ── 기본 도형(bmesh) ──
def bm_box(sx, sy, sz, z0=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, z0 + sz / 2), verts=bm.verts)
    return bm

def bm_cyl(r1, r2, h, seg=16, z0=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, z0 + h / 2), verts=bm.verts)
    return bm

def bm_ball(r, sub=1, sz=1.0, z0=None):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    bmesh.ops.scale(bm, vec=(1, 1, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, r * sz if z0 is None else z0), verts=bm.verts)
    return bm

def bm_torus(R, r, seg=24, rseg=8):
    bm = bmesh.new(); rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; ring = []
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            ring.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        rings.append(ring)
    for i in range(seg):
        for j in range(rseg):
            a, b = rings[i], rings[(i + 1) % seg]
            bm.faces.new((a[j], b[j], b[(j + 1) % rseg], a[(j + 1) % rseg]))
    return bm

def bm_ring(r_out, r_in, h, seg=24, z0=0.0):
    """속이 빈 원통(분수 테두리처럼)."""
    bm = bmesh.new(); top = []; bot = []; ti = []; bi = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; c, s = math.cos(a), math.sin(a)
        bot.append(bm.verts.new((r_out * c, r_out * s, z0))); top.append(bm.verts.new((r_out * c, r_out * s, z0 + h)))
        bi.append(bm.verts.new((r_in * c, r_in * s, z0))); ti.append(bm.verts.new((r_in * c, r_in * s, z0 + h)))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((bot[i], bot[j], top[j], top[i]))      # 바깥 벽
        bm.faces.new((ti[i], ti[j], bi[j], bi[i]))          # 안쪽 벽
        bm.faces.new((top[i], top[j], ti[j], ti[i]))        # 윗면
        bm.faces.new((bi[i], bi[j], bot[j], bot[i]))        # 아랫면
    return bm

def bm_heart(size, thick, n=40):
    """세워진 하트(앞면이 -Y 방향), 두께는 Y축."""
    bm = bmesh.new(); pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3; z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x / 32 * size, z / 32 * size))
    front = [bm.verts.new((x, -thick / 2, z)) for x, z in pts]
    back = [bm.verts.new((x, thick / 2, z)) for x, z in pts]
    bm.faces.new(front[::-1]); bm.faces.new(back)
    for i in range(n):
        j = (i + 1) % n; bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def bm_xform(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=None):
    if scale: bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    R = Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bmesh.ops.transform(bm, matrix=R, verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    return bm

def bm_merge(*bms):
    """여러 bmesh를 하나로(같은 재질끼리 합쳐 웹 draw call 줄이기)."""
    out = bmesh.new(); me = bpy.data.meshes.new('_tmp')
    for b in bms:
        b.to_mesh(me); out.from_mesh(me); b.free()
    bpy.data.meshes.remove(me)
    return out

def shade_flat(o):
    for p in o.data.polygons: p.use_smooth = False
