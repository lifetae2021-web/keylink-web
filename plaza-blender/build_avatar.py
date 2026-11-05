# 키링 월드 캐릭터 몸 만들기 — bl_execute에서 exec로 실행. 설계: avatar_spec.md
# 사용: STYLE='chibi' 또는 'semi'를 정한 뒤 exec(open(이 파일).read())
# 캐릭터는 Blender에서 -Y를 바라본다(웹 +Z). 단위 m, Z-up.
import bpy, bmesh, math
from mathutils import Vector, Matrix, Quaternion
exec(open('/Users/lifetae2021/Desktop/keylink/plaza-blender/kl_helpers.py').read())

# ── 그림체별 비율: 관절 위치(x는 오른쪽 기준 +, 왼쪽은 대칭) / 두께(rx, ry) ──
PROPORTIONS = {
  'chibi': dict(
    head_c=1.40, head_r=0.37, head_scale=(1.06, 0.97, 0.98), neck=(0.98, 1.06),
    pelvis=0.55, spine=0.70, chest=0.84,
    hip=(0.11, 0.52), knee=(0.12, 0.30), ankle=(0.12, 0.09), toe=(0.12, -0.11, 0.05),
    shoulder=(0.17, 0.90), elbow=(0.31, 0.77), wrist=(0.43, 0.65), hand=(0.48, 0.59),
    # 스킨+서브디비전이 살을 줄이므로 원하는 두께보다 크게 잡는다
    r=dict(pelvis=(0.30, 0.24), spine=(0.26, 0.20), chest=(0.28, 0.21), neck=(0.11, 0.10),
           hip=(0.15, 0.15), knee=(0.12, 0.12), ankle=(0.11, 0.12), toe=(0.11, 0.09),
           shoulder=(0.10, 0.10), elbow=(0.085, 0.085), wrist=(0.08, 0.08), hand=(0.11, 0.095))),
}

def scene_for_avatar():
    sc = bpy.data.scenes.get('KL_Avatar')
    if not sc:
        sc = bpy.data.scenes.new('KL_Avatar'); sc.render.fps = 24
        w = bpy.data.worlds.get('World'); sc.world = w
        ld = bpy.data.lights.new('LGT_av_sun', 'SUN'); ld.energy = 3.5; ld.color = (1.0, 0.95, 0.88)
        lo = bpy.data.objects.new('LGT_av_sun', ld); sc.collection.objects.link(lo); lo.rotation_euler = (0.9, 0.0, -0.6)
    bpy.context.window.scene = sc
    return sc

def av_coll(sc, style):
    name = 'AVATAR_' + style
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name); sc.collection.children.link(c)
    return c

def joints(P):
    """관절 이름 → 위치(왼쪽 .L은 +X, 오른쪽 .R은 -X; 캐릭터 기준 왼쪽 = 화면 오른쪽 아님 주의)"""
    J = {'pelvis': (0, 0, P['pelvis']), 'spine': (0, 0, P['spine']), 'chest': (0, 0, P['chest']),
         'neck': (0, 0, P['neck'][0]), 'head_base': (0, 0, P['neck'][1]),
         'head_top': (0, 0, P['head_c'] + P['head_r'] * P['head_scale'][2])}
    for s, sx in (('L', 1), ('R', -1)):
        J['hip.' + s] = (sx * P['hip'][0], 0, P['hip'][1]); J['knee.' + s] = (sx * P['knee'][0], 0, P['knee'][1])
        J['ankle.' + s] = (sx * P['ankle'][0], 0, P['ankle'][1]); J['toe.' + s] = (sx * P['toe'][0], P['toe'][1], P['toe'][2])
        J['shoulder.' + s] = (sx * P['shoulder'][0], 0, P['shoulder'][1]); J['elbow.' + s] = (sx * P['elbow'][0], 0, P['elbow'][1])
        J['wrist.' + s] = (sx * P['wrist'][0], 0, P['wrist'][1]); J['hand.' + s] = (sx * P['hand'][0], 0, P['hand'][1])
    return {k: Vector(v) for k, v in J.items()}

def build_body_mesh(name, P, J, coll, levels=2):
    """스킨 모디파이어로 관절 뼈대에 살을 입히고, 서브디비전 1단계 후 메시로 굳힌다."""
    order = ['pelvis', 'spine', 'chest', 'neck']
    for s in 'LR': order += ['hip.' + s, 'knee.' + s, 'ankle.' + s, 'toe.' + s, 'shoulder.' + s, 'elbow.' + s, 'wrist.' + s, 'hand.' + s]
    idx = {k: i for i, k in enumerate(order)}
    edges = [('pelvis', 'spine'), ('spine', 'chest'), ('chest', 'neck')]
    for s in 'LR':
        edges += [('pelvis', 'hip.' + s), ('hip.' + s, 'knee.' + s), ('knee.' + s, 'ankle.' + s), ('ankle.' + s, 'toe.' + s),
                  ('chest', 'shoulder.' + s), ('shoulder.' + s, 'elbow.' + s), ('elbow.' + s, 'wrist.' + s), ('wrist.' + s, 'hand.' + s)]
    drop(name + '_src')
    me = bpy.data.meshes.new(name + '_src'); me.from_pydata([tuple(J[k]) for k in order], [(idx[a], idx[b]) for a, b in edges], []); me.update()
    src = bpy.data.objects.new(name + '_src', me); coll.objects.link(src)
    sk = src.modifiers.new('Skin', 'SKIN'); sk.use_smooth_shade = True; sk.branch_smoothing = 0.6
    R = P['r']
    for k, i in idx.items():
        base = k.split('.')[0]; sv = me.skin_vertices[0].data[i]; sv.radius = R[base]; sv.use_root = (k == 'pelvis')
    ss = src.modifiers.new('Sub', 'SUBSURF'); ss.levels = levels; ss.render_levels = levels
    dg = bpy.context.evaluated_depsgraph_get(); ev = src.evaluated_get(dg)
    body_me = bpy.data.meshes.new_from_object(ev)
    bpy.data.objects.remove(src, do_unlink=True); bpy.data.meshes.remove(me)
    drop(name); body_me.name = name
    o = bpy.data.objects.new(name, body_me); coll.objects.link(o)
    for p in body_me.polygons: p.use_smooth = True
    return o

def build_head_mesh(name, P, coll):
    """얼굴 텍스처용 머리: 경도·위도 UV(정면 -Y가 u=0.5, 뒤통수가 이음매). 웹이 캔버스로 얼굴을 그린다."""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=P['head_r'])
    sx, sy, sz = P['head_scale']; bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        us = []
        for l in f.loops:
            c = l.vert.co; lon = math.atan2(c.x / sx, -c.y / sy); lat = math.asin(max(-1, min(1, c.z / (P['head_r'] * sz))))
            us.append([0.5 + lon / (2 * math.pi), 0.5 + lat / math.pi])
        uvals = [u for u, v in us]
        if max(uvals) - min(uvals) > 0.5:      # 뒤통수 이음매를 건너는 면
            for t in us:
                if t[0] < 0.5: t[0] += 1.0
        for l, (u, v) in zip(f.loops, us):
            if abs(l.vert.co.z) > P['head_r'] * sz * 0.999: u = 0.5   # 극점
            l[uv].uv = (u, v)
    bmesh.ops.translate(bm, vec=(0, 0, P['head_c']), verts=bm.verts)
    drop(name); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); coll.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o

BONES = [  # (이름, 머리 관절, 꼬리 관절, 부모)
  ('hips', 'pelvis', 'spine', 'root'), ('spine', 'spine', 'chest', 'hips'), ('chest', 'chest', 'neck', 'spine'),
  ('neck', 'neck', 'head_base', 'chest'), ('head', 'head_base', 'head_top', 'neck')]
for s in 'LR':
    BONES += [('upper_leg.' + s, 'hip.' + s, 'knee.' + s, 'hips'), ('lower_leg.' + s, 'knee.' + s, 'ankle.' + s, 'upper_leg.' + s),
              ('foot.' + s, 'ankle.' + s, 'toe.' + s, 'lower_leg.' + s),
              ('upper_arm.' + s, 'shoulder.' + s, 'elbow.' + s, 'chest'), ('lower_arm.' + s, 'elbow.' + s, 'wrist.' + s, 'upper_arm.' + s),
              ('hand.' + s, 'wrist.' + s, 'hand.' + s, 'lower_arm.' + s)]

def view3d_ctx():
    for a in bpy.context.window.screen.areas:
        if a.type == 'VIEW_3D':
            return dict(window=bpy.context.window, area=a, region=[r for r in a.regions if r.type == 'WINDOW'][0])

def build_armature(name, J, coll):
    drop(name)
    ad = bpy.data.armatures.new(name); arm = bpy.data.objects.new(name, ad); coll.objects.link(arm)
    ad.display_type = 'STICK'; arm.show_in_front = True
    bpy.context.view_layer.objects.active = arm
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects: o.select_set(False)
    arm.select_set(True)
    with bpy.context.temp_override(**view3d_ctx()):
        bpy.ops.object.mode_set(mode='EDIT')
        eb = ad.edit_bones
        r = eb.new('root'); r.head = (0, 0, 0); r.tail = (0, 0.25, 0)
        for bn, h, t, par in BONES:
            b = eb.new(bn); b.head = J[h]; b.tail = J[t]; b.parent = eb[par]
            b.use_connect = (par != 'root' and (eb[par].tail - b.head).length < 1e-4)
            b.roll = 0.0
        # 팔·다리 뼈의 굽는 방향을 일정하게(앞쪽 -Y를 로컬 Z로)
        for b in eb:
            if b.name != 'root': b.align_roll(Vector((0, -1, 0)))
        bpy.ops.object.mode_set(mode='OBJECT')
    return arm

def bind(mesh_obj, arm, auto=True, rigid_bone=None):
    mesh_obj.parent = arm
    for m in list(mesh_obj.modifiers):
        if m.type == 'ARMATURE': mesh_obj.modifiers.remove(m)
    if rigid_bone:
        mesh_obj.vertex_groups.clear(); vg = mesh_obj.vertex_groups.new(name=rigid_bone); vg.add(range(len(mesh_obj.data.vertices)), 1.0, 'REPLACE')
        md = mesh_obj.modifiers.new('Armature', 'ARMATURE'); md.object = arm; return 'rigid'
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects: o.select_set(False)
    mesh_obj.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    with bpy.context.temp_override(**view3d_ctx()):
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    vgs = [g.name for g in mesh_obj.vertex_groups]
    return vgs

# ── 슬라이더용 셰이프 키(웹 morphTargetInfluences로 조절) ──
def nearest_axis(co, arm, vname, body):
    """정점이 가장 크게 따르는 뼈의 축 위 가장 가까운 점(반경 방향 계산용)."""
    v = body.data.vertices[vname]
    if not v.groups: return co.copy()
    g = max(v.groups, key=lambda x: x.weight); b = arm.data.bones[body.vertex_groups[g.group].name]
    h, t = b.head_local, b.tail_local; d = t - h; k = max(0.0, min(1.0, (co - h).dot(d) / d.length_squared))
    return h + d * k

def add_body_keys(body, arm, P):
    me = body.data
    if not me.shape_keys: body.shape_key_add(name='Basis')
    base = [v.co.copy() for v in me.vertices]
    def key(name, fn):
        k = me.shape_keys.key_blocks.get(name) or body.shape_key_add(name=name, from_mix=False)
        for i, co in enumerate(base): k.data[i].co = fn(i, co)
    def radial(i, co, s):
        a = nearest_axis(co, arm, i, body); return a + (co - a) * s
    key('build_slim', lambda i, co: radial(i, co, 0.84))
    key('build_broad', lambda i, co: radial(i, co, 1.2))
    zp, zc = P['pelvis'], P['chest']
    def fem(i, co):
        c = co.copy()
        if c.z < zp + 0.05 and c.z > P['knee'][1]: c.x *= 1.07                       # 골반 조금 넓게
        elif zp + 0.05 <= c.z < zc - 0.02: c.x *= 0.9                               # 허리 잘록
        elif c.z >= zc - 0.02 and abs(c.x) < P['shoulder'][0] * 1.4: c.x *= 0.93    # 어깨 좁게
        return c
    key('female', fem)

def add_head_keys(head, P):
    me = head.data
    if not me.shape_keys: head.shape_key_add(name='Basis')
    base = [v.co.copy() for v in me.vertices]; zc = P['head_c']; r = P['head_r']
    def key(name, fn):
        k = me.shape_keys.key_blocks.get(name) or head.shape_key_add(name=name, from_mix=False)
        for i, co in enumerate(base): k.data[i].co = fn(co)
    def long(co):
        c = co.copy(); dz = c.z - zc
        if dz < 0: c.z = zc + dz * 1.14
        return c
    def vline(co):
        c = co.copy(); t = max(0.0, (zc - c.z) / r)                                 # 아래로 갈수록 갸름하게
        c.x *= 1 - 0.22 * t * t; c.z -= 0.04 * t * t * r / 0.37
        return c
    def cheek(co):
        c = co.copy(); t = max(0.0, 1 - abs((c.z - (zc - 0.35 * r)) / (0.5 * r)))   # 볼 높이에서 통통하게
        c.x *= 1 + 0.09 * t; c.y *= 1 + 0.04 * t
        return c
    key('face_long', long); key('face_vline', vline); key('cheek_full', cheek)

# ── 동작(Action): 회전 위주, hips만 높이 ──
def _q(pb, axis, deg):
    M = pb.bone.matrix_local.to_3x3(); ax = (M.inverted() @ Vector(axis)).normalized()
    return Quaternion(ax, math.radians(deg))

def make_action(arm, name, frames, keys_fn, loop=True):
    """keys_fn(frame_index, t[0..1]) → {bone: [(axis, deg), ...]}, 'hips_z': dz"""
    ad = arm.animation_data or arm.animation_data_create()
    old = bpy.data.actions.get(name)
    if old: bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name); act.use_fake_user = True; ad.action = act
    pbs = arm.pose.bones; rest_z = pbs['hips'].location.z
    for f in range(frames + 1):
        t = f / frames; pose = keys_fn(f, t)
        for pb in pbs:
            pb.rotation_mode = 'QUATERNION'; q = Quaternion()
            for axis, deg in pose.get(pb.name, []): q = _q(pb, axis, deg) @ q
            pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=f + 1)
        pbs['hips'].location = (0, pose.get('hips_up', 0.0), 0)   # hips 로컬 Y = 위쪽(뼈가 위를 향함)
        pbs['hips'].keyframe_insert('location', frame=f + 1)
    ad.action = None
    return act

def build_actions(arm, style):
    S = math.sin; T = 2 * math.pi
    def idle(f, t):
        b = S(T * t)
        return {'chest': [((1, 0, 0), -1.5 * b)], 'head': [((1, 0, 0), 1.2 * b)],
                'upper_arm.L': [((0, 1, 0), 2 * b)], 'upper_arm.R': [((0, 1, 0), -2 * b)], 'hips_up': 0.006 * b}
    def walk(f, t):
        s = S(T * t); c = math.cos(T * t)
        return {'upper_leg.L': [((1, 0, 0), -28 * s)], 'upper_leg.R': [((1, 0, 0), 28 * s)],
                'lower_leg.L': [((1, 0, 0), 30 * max(0, c))], 'lower_leg.R': [((1, 0, 0), 30 * max(0, -c))],
                'foot.L': [((1, 0, 0), -10 * s)], 'foot.R': [((1, 0, 0), 10 * s)],
                'upper_arm.L': [((1, 0, 0), 26 * s)], 'upper_arm.R': [((1, 0, 0), -26 * s)],
                'lower_arm.L': [((1, 0, 0), -12)], 'lower_arm.R': [((1, 0, 0), -12)],
                'hips': [((0, 0, 1), 5 * s)], 'chest': [((0, 0, 1), -7 * s)],
                'hips_up': 0.025 * abs(S(T * t))}
    def wave(f, t):
        w = S(T * t * 3)
        return {'upper_arm.L': [((0, 1, 0), -95), ((1, 0, 0), -15)], 'lower_arm.L': [((0, 1, 0), -30 + 22 * w)],
                'head': [((0, 1, 0), -6)], 'chest': [((0, 1, 0), -3)]}
    def sit(f, t):
        return {'upper_leg.L': [((1, 0, 0), -85)], 'upper_leg.R': [((1, 0, 0), -85)],
                'lower_leg.L': [((1, 0, 0), 85)], 'lower_leg.R': [((1, 0, 0), 85)],
                'upper_arm.L': [((1, 0, 0), -20)], 'upper_arm.R': [((1, 0, 0), -20)],
                'chest': [((1, 0, 0), 3 * S(T * t))], 'hips_up': -0.0}
    def dance(f, t):   # 두 팔 번갈아 흔들며 들썩이는 춤(1초에 두 박자)
        b = S(T * t * 2); c = S(T * t)
        return {'upper_arm.L': [((0, 1, 0), -70 - 35 * max(0, c)), ((1, 0, 0), -15)], 'upper_arm.R': [((0, 1, 0), 70 + 35 * max(0, -c)), ((1, 0, 0), -15)],
                'lower_arm.L': [((0, 1, 0), -40 * max(0, c))], 'lower_arm.R': [((0, 1, 0), 40 * max(0, -c))],
                'hips': [((0, 1, 0), 8 * c)], 'chest': [((0, 1, 0), -10 * c)], 'head': [((0, 1, 0), 8 * c)],
                'lower_leg.L': [((1, 0, 0), 18 * max(0, b))], 'lower_leg.R': [((1, 0, 0), 18 * max(0, -b))],
                'upper_leg.L': [((1, 0, 0), -10 * max(0, b))], 'upper_leg.R': [((1, 0, 0), -10 * max(0, -b))],
                'hips_up': 0.03 * abs(b)}
    return [make_action(arm, style + '_idle', 48, idle), make_action(arm, style + '_walk', 24, walk),
            make_action(arm, style + '_wave', 36, wave), make_action(arm, style + '_sit', 48, sit), make_action(arm, style + '_dance', 48, dance)]

def chest_weight_fix(body, P):
    """윗몸통 가운데가 팔뼈를 따라가면 팔을 흔들 때 가슴이 찌그러진다 → chest 뼈로 옮김."""
    G = {g.name: g for g in body.vertex_groups}; moved = 0
    for v in body.data.vertices:
        if abs(v.co.x) < P['shoulder'][0] * 0.88 and v.co.z > P['spine']:
            w = {body.vertex_groups[g.group].name: g.weight for g in v.groups}
            t = sum(w.get(n, 0) for n in ('upper_arm.L', 'upper_arm.R'))
            if t > 0:
                for n in ('upper_arm.L', 'upper_arm.R'): G[n].remove([v.index])
                G['chest'].add([v.index], w.get('chest', 0) + t, 'REPLACE'); moved += 1
    return moved

def rebuild_body(style, levels=2):
    P = PROPORTIONS[style]; C = bpy.data.collections['AVATAR_' + style]; J = joints(P)
    arm = bpy.data.objects['AV_%s_RIG' % style]; arm.data.bones['root'].use_deform = False
    body = build_body_mesh('AV_%s_BODY' % style, P, J, C, levels)
    bind(body, arm); moved = chest_weight_fix(body, P); add_body_keys(body, arm, P)
    body.data.materials.clear(); body.data.materials.append(bpy.data.materials['MAT_av_skin'])
    return body, moved
