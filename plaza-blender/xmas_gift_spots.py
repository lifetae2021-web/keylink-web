# 크리스마스 맵 선물 찾기 자리 — kl_helpers.py와 함께 exec(build_xmas_map.py 다음).
# 원본 좌표는 public/plaza/keys.js 의 GIFT_SPOTS(웹 좌표 x, y, z). Blender 좌표 = (x, -z, y)
# 웹은 kl_role=key 표시점을 찾아 선물 상자를 띄우고, 실시간 서버는 keys.js 목록으로 위치를 확인한다.
import bpy, re, math

src = open('/Users/lifetae2021/Desktop/keylink/public/plaza/keys.js', encoding='utf8').read()
block = src.split('export const GIFT_SPOTS', 1)[1].split('];', 1)[0]
spots = [(m.group(1), float(m.group(2)), float(m.group(3)), float(m.group(4)))
         for m in re.finditer(r"id: '([^']+)', x: (-?[\d.]+), y: (-?[\d.]+), z: (-?[\d.]+)", block)]

sc = bpy.data.scenes['KL_Xmas']; PROPS = bpy.data.collections['XMAS_props']
for o in [o for o in sc.objects if o.name.startswith('KEY_g_')]: bpy.data.objects.remove(o, do_unlink=True)

# 막힌 자리인지 확인: 충돌 원(COL_*, kl_block)과 집 몸통 상자
cols = [(o.matrix_world.translation.x, o.matrix_world.translation.y, float(o.get('kl_block', 0))) for o in sc.objects if o.get('kl_block')]
bodies = [o for o in sc.objects if 'cottage' in o.name and o.name.endswith('_body')]
report = {}
for sid, x, y, z in spots:
    bx, by = x, -z
    e = empty('KEY_' + sid, PROPS, (bx, by, y), kl_role='key', kl_id=sid)
    e['kl_theme'] = 'xmas'
    near = min((math.hypot(bx - cx, by - cy) - r for cx, cy, r in cols), default=99)
    inbody = any(min(v[0] for v in b.bound_box) - 0.6 < (b.matrix_world.inverted() @ e.matrix_world.translation).x < max(v[0] for v in b.bound_box) + 0.6 and
                 min(v[1] for v in b.bound_box) - 0.6 < (b.matrix_world.inverted() @ e.matrix_world.translation).y < max(v[1] for v in b.bound_box) + 0.6 for b in bodies)
    report[sid] = {'clear_m': round(near, 2), 'in_house': inbody, 'r': round(math.hypot(bx, by), 1)}
result = {'spots': len(spots), 'report': report}
