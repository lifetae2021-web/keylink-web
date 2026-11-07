# 크리스마스 맵 인형뽑기 기계 — kl_helpers.py를 exec한 다음 실행(KL_Xmas 장면).
# 자리: 마켓 거리 북쪽 노점 줄 끝(x=29.5, y=4.4), 앞면(로컬 -Y)이 거리(y=0)를 본다. 높이 약 2m.
# 웹은 ANC_claw(kl_role=claw) 자리에서 '인형뽑기' 버튼을 띄우고, COL_claw로 부딪힘을 만든다.
# 간판 둘레 전구는 이름이 XMAS_b_claw_lights라 웹에서 반짝인다(twinkle), *_glow는 밤에 빛난다(nightGlow).
import bpy, bmesh, math
from mathutils import Vector, Matrix

sc = bpy.data.scenes['KL_Xmas']
PROPS = bpy.data.collections['XMAS_props']
X, Y, FACE = 29.5, 4.4, 0.0          # FACE: 앞면 회전(0 = 로컬 -Y가 월드 -Y)
W, D = 0.95, 0.9

R = Matrix.Translation((X, Y, 0)) @ Matrix.Rotation(FACE, 4, 'Z')
def place(bm): bmesh.ops.transform(bm, matrix=R, verts=bm.verts); return bm
def box(sx, sy, sz, x=0, y=0, z0=0): return bm_xform(bm_box(sx, sy, sz, z0), loc=(x, y, 0))
made = []
def put(name, bm, m, smooth=False, **props):
    drop(name); o = obj_from_bm(name, place(bm), m, PROPS)
    for p in o.data.polygons: p.use_smooth = smooth
    o['kl_theme'] = 'xmas'
    for k, v in props.items(): o[k] = v
    made.append(name); return o

M = {
    'red': mat('XM_claw_red', (0.78, 0.07, 0.12), 0.45),
    'gold': mat('XM_claw_gold', (0.95, 0.72, 0.25), 0.3, metal=0.8),
    'pink': mat('XM_claw_pink_glow', (1.0, 0.45, 0.7), 0.4, emit=(1.0, 0.35, 0.65), emit_str=1.4),
    'dark': mat('XM_claw_dark', (0.06, 0.05, 0.08), 0.6),
    'silver': mat('XM_claw_silver', (0.8, 0.82, 0.86), 0.25, metal=0.9),
    'bulb': mat('XM_claw_bulb_glow', (1.0, 0.92, 0.6), 0.4, emit=(1.0, 0.85, 0.5), emit_str=1.6),
    'knob': mat('XM_claw_knob', (0.95, 0.15, 0.2), 0.3),
}
glass = bpy.data.materials.get('XM_claw_glass') or bpy.data.materials.new('XM_claw_glass')
glass.use_nodes = True
bsdf = next(n for n in glass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value = (0.75, 0.88, 1.0, 1); bsdf.inputs['Roughness'].default_value = 0.05
bsdf.inputs['Alpha'].default_value = 0.18
glass.blend_method = 'BLEND' if hasattr(glass, 'blend_method') else glass.blend_method
try: glass.surface_render_method = 'BLENDED'
except Exception: pass
DOLL = [mat(f'XM_claw_doll_{i}', c, 0.85) for i, c in enumerate([(1.0, 0.75, 0.8), (0.7, 0.85, 1.0), (1.0, 0.9, 0.55), (0.75, 0.95, 0.75), (0.9, 0.75, 1.0), (0.98, 0.98, 0.95), (0.85, 0.6, 0.4)])]

# 몸통(아래 캐비닛) + 금색 띠 + 인형 나오는 구멍 + 조종대
put('XMAS_claw_cabinet', box(W, D, 0.85), M['red'])
put('XMAS_claw_trim', bm_merge(box(W + 0.03, D + 0.03, 0.05, z0=0.82), box(W + 0.03, D + 0.03, 0.05, z0=0.0), box(W + 0.03, D + 0.03, 0.05, z0=1.62)), M['gold'])
put('XMAS_claw_chute', box(0.3, 0.04, 0.28, x=-0.28, y=-D / 2 - 0.005, z0=0.18), M['dark'])
panel = bm_xform(bm_box(W * 0.9, 0.32, 0.08), loc=(0, -D / 2 - 0.12, 0.78), rot=(-0.35, 0, 0))
put('XMAS_claw_panel', panel, M['dark'])
stick = bm_merge(bm_xform(bm_cyl(0.018, 0.018, 0.16, 8), loc=(0.12, -D / 2 - 0.13, 0.82)), bm_xform(bm_ball(0.045, 2), loc=(0.12, -D / 2 - 0.13, 0.98)))
put('XMAS_claw_stick', stick, M['knob'], smooth=True)
put('XMAS_claw_button_glow', bm_xform(bm_cyl(0.04, 0.04, 0.03, 12), loc=(-0.15, -D / 2 - 0.14, 0.84)), M['pink'], smooth=True)

# 유리 진열장 + 네 모서리 기둥
put('XMAS_claw_glass', box(W - 0.04, D - 0.04, 0.77, z0=0.85), glass)
posts = [box(0.05, 0.05, 0.8, x=sx * (W / 2 - 0.025), y=sy * (D / 2 - 0.025), z0=0.84) for sx in (-1, 1) for sy in (-1, 1)]
put('XMAS_claw_posts', bm_merge(*posts), M['gold'])

# 안쪽: 인형 더미 + 집게
import random
rng = random.Random(7); dolls = {i: [] for i in range(len(DOLL))}
for k in range(26):
    r = rng.uniform(0.07, 0.1); x = rng.uniform(-W / 2 + 0.12, W / 2 - 0.12); y = rng.uniform(-D / 2 + 0.12, D / 2 - 0.12)
    z = 0.86 + r + (0.06 if k > 13 else 0.0) + rng.uniform(0, 0.04)
    b = bm_ball(r, 2); bm_xform(b, loc=(x, y, z)); dolls[k % len(DOLL)].append(b)
    for ex in (-0.6, 0.6):   # 귀 두 개(곰·토끼 인형 느낌)
        e = bm_ball(r * 0.38, 1); bm_xform(e, loc=(x + ex * r, y, z + r * 0.85)); dolls[k % len(DOLL)].append(e)
for i, bl in dolls.items():
    if bl: put(f'XMAS_claw_dolls_{i}', bm_merge(*bl), DOLL[i], smooth=True)
claw = [bm_xform(bm_cyl(0.008, 0.008, 0.3, 6), loc=(0.1, 0.05, 1.32)), bm_xform(bm_cyl(0.04, 0.03, 0.06, 10), loc=(0.1, 0.05, 1.27))]
for a in range(3):
    ang = a * math.tau / 3
    claw.append(bm_xform(bm_box(0.018, 0.018, 0.14), loc=(0.1 + math.cos(ang) * 0.04, 0.05 + math.sin(ang) * 0.04, 1.14), rot=(math.sin(ang) * 0.5, -math.cos(ang) * 0.5, 0)))
put('XMAS_claw_claw', bm_merge(*claw), M['silver'])
put('XMAS_claw_rail', bm_merge(box(W - 0.08, 0.03, 0.03, z0=1.6), box(0.03, D - 0.08, 0.03, x=0.1, z0=1.6)), M['silver'])

# 머리 간판(분홍, 빛남) + 둘레 전구
put('XMAS_claw_header', box(W + 0.06, D + 0.06, 0.32, z0=1.67), M['red'])
put('XMAS_claw_sign_glow', box(W - 0.1, 0.03, 0.2, y=-D / 2 - 0.045, z0=1.73), M['pink'])
heart = bm_heart(0.16, 0.04); bm_xform(heart, loc=(0, -D / 2 - 0.07, 1.83), rot=(math.pi / 2, 0, 0))
put('XMAS_claw_heart_glow', heart, M['bulb'], smooth=True)
bulbs = []
for k in range(9):
    x = -W / 2 + 0.06 + k * (W - 0.12) / 8
    for z in (1.7, 1.96):
        b = bm_ball(0.022, 1); bm_xform(b, loc=(x, -D / 2 - 0.035, z)); bulbs.append(b)
put('XMAS_b_claw_lights', bm_merge(*bulbs), M['bulb'], smooth=True)

# 웹 연결용: 상호작용 자리(앞쪽 1m)와 부딪힘
drop('ANC_claw'); a = empty('ANC_claw', PROPS, (0, 0, 0), kl_role='claw', kl_theme='xmas')
a.matrix_world = R @ Matrix.Translation((0, -D / 2 - 1.0, 0)); made.append('ANC_claw')
COLS = next((c for c in bpy.data.collections if c.name.startswith('XMAS_col')), PROPS)
drop('COL_claw'); c = empty('COL_claw', COLS, (X, Y, 0), kl_role='collider_circle', kl_block=0.75); made.append('COL_claw')
result = {'made': made}
