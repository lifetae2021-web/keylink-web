# 키링 월드 블록 스타일 픽셀 텍스처(16×16 = 블록 한 칸 1m). 키링크 색으로 직접 만든 것 — 다른 게임 텍스처를 쓰지 않는다.
import random
from PIL import Image
OUT = 'plaza-blender/textures/blocky/'
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def jitter(c, a, r): return tuple(max(0, min(255, v + r.randint(-a, a))) for v in c)
def make(name, fn, seed):
    r = random.Random(seed); im = Image.new('RGB', (16, 16))
    for y in range(16):
        for x in range(16): im.putpixel((x, y), fn(x, y, r))
    im.save(OUT + name + '.png')
G = [hexc(c) for c in ('#8fd27a', '#84cb70', '#9ad985', '#7bc268')]
make('grass', lambda x, y, r: r.choice(G) if r.random() > 0.04 else hexc('#b9e79f'), 1)
def plaza(x, y, r):   # 크림색 돌 타일 한 장(블록 한 칸) + 테두리 줄눈 + 살짝 얼룩
    if x == 0 or y == 0: return hexc('#dccdab')
    if x == 15 or y == 15: return hexc('#e8dbbd')
    return jitter(hexc('#f4e8cc'), 7, r)
make('plaza', plaza, 2)
D = [hexc(c) for c in ('#dcbc8c', '#d3b080', '#e3c597', '#cba776')]
make('dirt', lambda x, y, r: r.choice(D) if r.random() > 0.06 else hexc('#b89668'), 3)
def wood(x, y, r):    # 가로 판자 4장
    if y % 4 == 0: return hexc('#9b6a43')
    if (x + (y // 4) * 5) % 16 == 0: return hexc('#a8744b')
    return jitter(hexc('#c79461'), 7, r)
make('wood', wood, 4)
L = [hexc(c) for c in ('#5fb156', '#55a54d', '#6cbd60', '#4c9945')]
make('leaves', lambda x, y, r: r.choice(L) if r.random() > 0.08 else hexc('#3f8a3c'), 5)
def wall(x, y, r):    # 크림 회벽 + 옅은 벽돌 줄
    if y % 4 == 3 or (x + (4 if (y // 4) % 2 else 0)) % 8 == 7: return hexc('#e6dcc4')
    return jitter(hexc('#f7efdc'), 4, r)
make('wall', wall, 6)
def roof(base):
    b = hexc(base)
    def f(x, y, r):
        if y % 4 == 3: return tuple(int(v * 0.82) for v in b)
        if (x + (2 if (y // 4) % 2 else 0)) % 4 == 3: return tuple(int(v * 0.9) for v in b)
        return jitter(b, 5, r)
    return f
for n, c in (('roof_mint', '#9fe0c8'), ('roof_peach', '#ffb9a0'), ('roof_lilac', '#c9b3f0'), ('roof_red', '#f08a7e')):
    make(n, roof(c), 7)
def stone(x, y, r):
    if y % 8 == 7 or (x + (4 if (y // 8) % 2 else 0)) % 8 == 7: return hexc('#c9c2b4')
    return jitter(hexc('#ebe6dc'), 5, r)
make('stone', stone, 8)
def bark(x, y, r):   # 세로 결 나무껍질
    if x % 4 == 0: return hexc('#6e4a2e')
    return jitter(hexc('#8c6040'), 7, r)
make('bark', bark, 9)
def glass(x, y, r):  # 창문: 하늘빛 + 십자 창살
    if x in (0, 15) or y in (0, 15) or x == 7 or y == 7: return hexc('#ffffff')
    return hexc('#bfe6f5') if (x + y) % 9 else hexc('#e6f7fd')
make('glass', glass, 10)
def door(x, y, r):   # 문: 세로 판자 + 손잡이
    if (x, y) in ((12, 8), (12, 9)): return hexc('#f0c04b')
    if x % 5 == 0 or y in (0, 15): return hexc('#7a5032')
    return jitter(hexc('#a06b42'), 6, r)
make('door', door, 11)
print('ok')
