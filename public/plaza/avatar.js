// 키링 월드 캐릭터: Blender에서 만든 avatar_<style>.glb(뼈대·셰이프 키·부위·동작)를 불러와 look v2대로 꾸민다.
// 얼굴은 캔버스에 그려 머리 텍스처로 입힌다(눈·눈썹·입·볼터치를 슬라이더로 바꿀 수 있게).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { sanitizeLook, visibleParts } from './look.js';

const cache = {};
export function loadAvatarAssets(style = 'chibi') {
  if (!cache[style]) cache[style] = new Promise((res, rej) => new GLTFLoader().load('/plaza/assets/avatar_' + style + '.glb', res, undefined, rej));
  return cache[style];
}

// ── 얼굴 그리기: 머리 UV는 경위도(정면 = 가운데). 경도 lon°, 위도 lat° → 캔버스 좌표 ──
// 블록 머리는 앞면이 얼굴 그림의 ±30°(작은 칸)만 써서 눈이 몇 픽셀로 뭉개지고 양쪽 크기가 달라 보였다 →
// 블록은 그림을 FACE_ZOOM배 크게 그리고, 머리 UV도 같은 배율로 넓혀(mount) 같은 자리에 선명하게 입힌다.
const FACE_ZOOM = { block: 3 };
// 눈 크기(배율)·좌우 간격(경도°)·높이(위도°) — 얼굴 그림과 안경 맞추기가 같이 쓴다
function eyeLayout(look) {
  const chibi = look.style === 'chibi';
  return { es: (1 + 0.28 * look.eyeSize) * (chibi ? 1.4 : 1), gap: (chibi ? 19 : 17) + 4 * look.eyeGap, ey: (chibi ? -10 : -6) + 5 * look.eyeY + (look.style === 'block' ? -4 : 0) };
}
// 안경 부품이 처음 맞춰진 눈(위도 -6°, 간격 17°, 배율 1)과 머리 모양. 눈이 바뀐 만큼 안경을 옮기고 키운다
// chibi: 구(중심 높이 cy·반지름 r) / block: 앞면이 얼굴 그림 ±span°에 대응하는 상자(중심 cy·반높이 hh)
// inner·fade: 이 x보다 안쪽(알·코받침)은 다 맞추고, 바깥(귀에 걸리는 다리)은 fade 폭에 걸쳐 원래대로
const GLASS_REF = { chibi: { cy: 1.40, r: 0.3626, lat0: -6, lon0: 17, inner: 0.16, fade: 0.12 },
  block: { box: true, cy: 1.54, hh: 0.32, span: 30, lat0: -6, lon0: 17, inner: 0.27, fade: 0.06 } };
function fitGlasses(o, look, style) {
  const ref = GLASS_REF[style], base = o.userData.basePos; if (!ref || !base) return;
  const D = Math.PI / 180, e = eyeLayout(look);
  const cy0 = ref.box ? ref.cy + ref.hh * ref.lat0 / ref.span : ref.cy + ref.r * Math.sin(ref.lat0 * D);
  const dy = ref.box ? ref.hh * (e.ey - ref.lat0) / ref.span : ref.r * (Math.sin(e.ey * D) - Math.sin(ref.lat0 * D));
  const fx = (ref.box ? e.gap / ref.lon0 : Math.sin(e.gap * D) / Math.sin(ref.lon0 * D)) * (1 + (e.es - 1) * 0.35), fy = 1 + (e.es - 1) * 0.6;
  const p = o.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    const w = Math.max(0, Math.min(1, 1 - (Math.abs(x) - ref.inner) / ref.fade));
    p.setXYZ(i, x * (1 + (fx - 1) * w), cy0 + (y - cy0) * (1 + (fy - 1) * w) + dy, z);
  }
  p.needsUpdate = true; o.geometry.computeBoundingSphere();
}
export function drawFace(cv, look) {
  const S = FACE_ZOOM[look.style] || 1;
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), k = W / 1024 * S;
  const P = (lon, lat) => [W * (0.5 + lon * S / 360), H * (0.5 - lat * S / 180)];
  g.fillStyle = look.colors.skin; g.fillRect(0, 0, W, H);
  // 블록 머리는 앞머리가 이마를 덮어서 눈·눈썹·입을 조금 아래로(얼굴 가운데에 오게)
  // 귀여운(chibi)은 눈을 크게, 얼굴 아래쪽에 두고 반짝임·속눈썹을 더한다(아기 얼굴 비율)
  const chibi = look.style === 'chibi';
  const { es, gap, ey } = eyeLayout(look);
  const ink = '#2b2020', brow = new THREE.Color(look.colors.hair).multiplyScalar(0.7).getStyle();
  // 볼터치
  if (look.blush > 0 && chibi) {
    for (const s of [-1, 1]) { const [x, y] = P(s * (gap + 9), ey - 19); const gr = g.createRadialGradient(x, y, 0, x, y, 26 * k);
      gr.addColorStop(0, `rgba(255,120,140,${0.6 * look.blush})`); gr.addColorStop(1, 'rgba(255,120,140,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 26 * k, 15 * k, 0, 0, Math.PI * 2); g.fill(); }
  } else if (look.blush > 0) {
    g.fillStyle = `rgba(255,140,150,${0.55 * look.blush})`;
    for (const s of [-1, 1]) { const [x, y] = P(s * (gap + 10), ey - 11); g.beginPath(); g.ellipse(x, y, 20 * k, 9 * k, 0, 0, Math.PI * 2); g.fill(); }
  }
  // 눈
  for (const s of [-1, 1]) {
    const [x, y] = P(s * gap, ey), rx = 13 * k * es, ry = 19 * k * es; g.lineCap = 'round';
    if (look.eye === 'smile') { g.strokeStyle = ink; g.lineWidth = 5 * k; g.beginPath(); g.arc(x, y + 6 * k * es, rx, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
    g.save(); g.beginPath();
    if (look.eye === 'sharp') { g.translate(x, y); g.rotate(-s * 0.18); g.ellipse(0, 0, rx * 1.15, ry * 0.72, 0, 0, Math.PI * 2); g.translate(-x, -y); }
    else g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.clip();
    if (chibi && look.eye !== 'round') { const ec = new THREE.Color(look.colors.eyeColor), gr = g.createLinearGradient(0, y - ry, 0, y + ry);
      gr.addColorStop(0, ec.clone().multiplyScalar(0.45).getStyle()); gr.addColorStop(0.55, ec.getStyle()); gr.addColorStop(1, ec.clone().lerp(new THREE.Color('#ffffff'), 0.35).getStyle()); g.fillStyle = gr; }   // 위는 진하고 아래로 갈수록 밝은 눈동자
    else g.fillStyle = look.eye === 'round' ? ink : look.colors.eyeColor;
    g.fillRect(x - rx * 1.6, y - ry * 1.6, rx * 3.2, ry * 3.2);
    if (look.eye !== 'round') { g.fillStyle = ink; g.beginPath(); g.ellipse(x, y + 2 * k, rx * 0.55, ry * 0.6, 0, 0, Math.PI * 2); g.fill(); }
    if (look.eye === 'sleepy') { g.fillStyle = look.colors.skin; g.fillRect(x - rx * 2, y - ry * 2, rx * 4, ry * 1.55); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4 * k * es, y - (look.eye === 'sleepy' ? -4 : 8) * k * es, 4.5 * k * es, 0, Math.PI * 2); g.fill();
    if (look.eye === 'sparkle' || chibi) { g.beginPath(); g.arc(x - 4 * k * es, y + 7 * k * es, (look.eye === 'sparkle' ? 2.5 : 2) * k * es, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // 귀여운: 위 속눈썹 선(눈매가 또렷하게)
    if (chibi && look.eye !== 'sleepy') { g.strokeStyle = ink; g.lineWidth = 4.5 * k; g.beginPath();
      if (look.eye === 'sharp') { g.save(); g.translate(x, y); g.rotate(-s * 0.18); g.ellipse(0, 0, rx * 1.18, ry * 0.76, 0, Math.PI * 1.08, Math.PI * 1.92); g.restore(); }
      else g.ellipse(x, y, rx * 1.04, ry * 1.03, 0, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke(); }
    if (look.eye === 'sleepy') { g.strokeStyle = ink; g.lineWidth = 4 * k; g.beginPath(); g.moveTo(x - rx, y - ry * 0.45); g.lineTo(x + rx, y - ry * 0.45); g.stroke(); }
  }
  // 눈썹
  g.strokeStyle = brow; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const [x, y] = P(s * (gap + 1), ey + (chibi ? 21 : 15) + 2 * look.eyeSize), w = (chibi ? 14 : 17) * k;
    g.lineWidth = (look.brow === 'thick' ? 8 : 4.5) * k; g.beginPath();
    if (look.brow === 'straight') { g.moveTo(x - w, y); g.lineTo(x + w, y); }
    else if (look.brow === 'arched') { g.moveTo(x - w, y + 3 * k); g.quadraticCurveTo(x + s * 2 * k, y - 9 * k, x + w, y + 3 * k); }
    else { g.moveTo(x - w, y + 2 * k); g.quadraticCurveTo(x, y - 4 * k, x + w, y + 2 * k); }
    g.stroke();
  }
  // 입
  const [mx, my] = P(0, ey - (chibi ? 20 : 15)); g.strokeStyle = '#9a4a4a'; g.lineWidth = 4 * k; g.beginPath();
  if (look.mouth === 'grin') { g.fillStyle = '#b2484f'; g.moveTo(mx - 12 * k, my - 3 * k); g.quadraticCurveTo(mx, my + 16 * k, mx + 12 * k, my - 3 * k); g.closePath(); g.fill(); }
  else if (look.mouth === 'small') { g.arc(mx, my, 4 * k, 0, Math.PI * 2); g.stroke(); }
  else if (look.mouth === 'cat') { g.moveTo(mx - 11 * k, my - 2 * k); g.quadraticCurveTo(mx - 5.5 * k, my + 6 * k, mx, my - 1 * k); g.quadraticCurveTo(mx + 5.5 * k, my + 6 * k, mx + 11 * k, my - 2 * k); g.stroke(); }
  else if (look.mouth === 'neutral') { g.moveTo(mx - 8 * k, my); g.lineTo(mx + 8 * k, my); g.stroke(); }
  else { g.arc(mx, my - 6 * k, 10 * k, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
}

// 귀여운 그림체: 머리 크기 배율, 피부가 밤 조명에 칙칙해지지 않게 스스로 살짝 빛나는 정도
const STYLE_HEAD = { chibi: 1.16 };
// 귀여운: 머리를 목 쪽으로 내려 어깨에 얹힌 느낌으로(반팔·셔츠처럼 목이 드러나는 옷에서 머리가 떠 보였다). 머리 뼈 위치(m)
const STYLE_HEAD_DROP = { chibi: 0.045 };
// 귀여운: 팔을 몸 쪽으로 내린다(라디안). 원래 자세가 팔을 45도로 벌린 A자라 소매가 판자처럼 뻗고 몸통이 네모 자루처럼 보였다
const STYLE_ARM_DOWN = { chibi: 0.5 };
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qm = new THREE.Quaternion(), _fwd = new THREE.Vector3(0, 0, 1), _v = new THREE.Vector3();
const SKIN_GLOW = 0.22;
const ACT = { idle: 'idle', walk: 'walk', wave: 'wave', sit: 'sit', dance: 'dance', run: 'run' };
let _heart = null;   // 하트 이모트 그림(한 번만 그려서 같이 씀)
function heartTex() {
  if (_heart) return _heart;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ff6f91'; g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(4, 34, 8, 8, 32, 20); g.bezierCurveTo(56, 8, 60, 34, 32, 54); g.fill();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(22, 22, 5, 0, Math.PI * 2); g.fill();
  _heart = new THREE.CanvasTexture(c); _heart.colorSpace = THREE.SRGBColorSpace; return _heart;
}

// 캐릭터 하나 만들기: 바로 빈 그룹을 돌려주고, 파일이 준비되면 채운다
export function createAvatar(rawLook, { faceSize = 512 } = {}) {
  const group = new THREE.Group(), self = { group, ready: false, look: sanitizeLook(rawLook), mixer: null, actions: {}, cur: null };
  const cv = document.createElement('canvas'); cv.width = faceSize; cv.height = faceSize / 2;
  const faceTex = new THREE.CanvasTexture(cv); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.flipY = false; faceTex.wrapS = THREE.RepeatWrapping;
  let model = null, parts = [], morphMeshes = [], skinMats = [], busy = null, hearts = [], headBone = null, headScale = 1, headDrop = 0, headBaseY = 0, armBones = [], armDown = 0;
  self.setLook = (raw) => {
    self.look = sanitizeLook(raw); const L = self.look;
    if (mounted && L.style !== mounted) { mount(L.style); }
    drawFace(cv, L); faceTex.needsUpdate = true;
    if (!model) return;
    const vis = visibleParts(L);
    for (const o of parts) {
      const u = o.userData, want = u.kl_part === 'acc' ? vis.acc.includes(u.kl_type) : vis[u.kl_part] === u.kl_type; o.visible = want;
      if (want && o.material && o.material.userData.tint) o.material.color.set(L.colors[u.kl_part === 'hair' ? 'hair' : u.kl_part]);
      if (want && u.kl_type === 'glasses') fitGlasses(o, L, mounted);
    }
    for (const m of skinMats) { m.color.set(L.colors.skin); if (mounted === 'chibi') m.emissive.set(L.colors.skin); }
    // 블록 머리는 네모가 기본 — 갸름한 턱·볼살을 쓰면 앞면이 사다리꼴로 찌그러져 얼굴 그림(눈·볼터치)까지 눌린다 → 블록은 적용 안 함
    const sq = L.style === 'block';
    const mv = { build_slim: Math.max(0, -L.build), build_broad: Math.max(0, L.build), female: L.female, face_long: L.long, face_vline: sq ? 0 : L.vline, cheek_full: sq ? 0 : L.cheek };
    for (const o of morphMeshes) for (const [k, i] of Object.entries(o.morphTargetDictionary)) if (k in mv) o.morphTargetInfluences[i] = mv[k];
    model.scale.setScalar(1 + 0.07 * L.height);
  };
  self.play = (name, fade = 0.25) => {
    const a = self.actions[name]; if (!a || self.cur === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play(); if (self.cur) self.cur.fadeOut(fade); self.cur = a;
  };
  // 이모트·앉기: 움직이면 풀린다. 인사·춤은 몇 번 하고 저절로 서기로 돌아감
  self.emote = (name) => {
    if (name === 'heart') { spawnHearts(); name = 'wave'; }
    const a = self.actions[name]; if (!a) return; busy = name; self.play(name, 0.2);
  };
  self.setSit = (on) => { if (on) { busy = 'sit'; self.play('sit', 0.25); } else if (busy === 'sit') { busy = null; self.play('idle', 0.25); } };
  self.isSitting = () => busy === 'sit';
  function spawnHearts() {
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex(), transparent: true, depthWrite: false }));
      s.scale.setScalar(0.32); s.position.set((Math.random() - 0.5) * 0.7, 1.9 + Math.random() * 0.2, (Math.random() - 0.5) * 0.3);
      s.userData = { t: -i * 0.18, vx: (Math.random() - 0.5) * 0.3 }; group.add(s); hearts.push(s);
    }
  }
  self.update = (dt, moving, running = false) => {
    for (const h of [...hearts]) { const u = h.userData; u.t += dt; if (u.t < 0) { h.visible = false; continue; } h.visible = true;
      h.position.y += dt * 0.7; h.position.x += u.vx * dt; h.material.opacity = Math.max(0, 1 - u.t / 1.6);
      if (u.t > 1.6) { group.remove(h); h.material.dispose(); hearts.splice(hearts.indexOf(h), 1); } }
    if (!self.mixer) return;
    if (moving) { busy = null; self.play(running && self.actions.run ? 'run' : 'walk', 0.18); }
    else if (!busy) self.play('idle');
    self.mixer.update(dt);
    if (headBone && headScale !== 1) headBone.scale.setScalar(headScale);   // 동작 파일에 크기·위치 키가 있어 매 프레임 덮어쓴다
    if (headBone && headDrop) headBone.position.y = headBaseY - headDrop;   // 기본 위치에서 뺀 값으로 고정(빼기를 쌓으면 머리가 계속 내려간다)
    if (armDown && armBones.length) lowerArms();
  };
  // 동작이 정한 팔 회전 위에, 캐릭터 기준 앞뒤 축으로 팔을 몸 쪽으로 더 돌린다(동작마다 매 프레임 새로 정해지므로 쌓이지 않음)
  function lowerArms() {
    model.updateMatrixWorld(true); model.getWorldQuaternion(_qm).invert();
    for (const a of armBones) {
      a.bone.parent.getWorldQuaternion(_qp).premultiply(_qm);
      _q.setFromAxisAngle(_fwd, a.sign * armDown);
      a.bone.quaternion.premultiply(_qp.clone().invert().multiply(_q).multiply(_qp));
    }
  }
  self.dispose = () => { faceTex.dispose(); group.traverse((o) => { if (o.isMesh) { o.material?.dispose?.(); } }); };
  drawFace(cv, self.look);
  // 그림체(style)마다 파일이 다르다 — 바뀌면 모델을 통째로 다시 붙인다
  let mounted = null;
  function mount(style) {
    mounted = style;
    loadAvatarAssets(style).then((gltf) => {
    if (mounted !== style) return;
    if (model) { group.remove(model); model.traverse((o) => { if (o.isMesh && o.material && o.material !== gltf) o.material.dispose?.(); }); }
    parts = []; morphMeshes = []; skinMats = []; self.actions = {}; self.cur = null; busy = null;
    model = SkeletonUtils.clone(gltf.scene); group.add(model);
    // 귀여운: 머리를 키워 2등신에 가깝게(모자·머리카락도 머리 뼈를 따라 같이 커진다)
    headBone = model.getObjectByName('head'); headScale = STYLE_HEAD[style] || 1; headDrop = STYLE_HEAD_DROP[style] || 0; headBaseY = headBone ? headBone.position.y : 0;
    armDown = STYLE_ARM_DOWN[style] || 0; armBones = [];
    if (armDown) { model.updateMatrixWorld(true); for (const n of ['upper_arm.L', 'upper_arm.R', 'upper_armL', 'upper_armR']) { const b = model.getObjectByName(n); if (b && !armBones.some((x) => x.bone === b)) { b.getWorldPosition(_v); model.worldToLocal(_v); armBones.push({ bone: b, sign: _v.x > 0 ? -1 : 1 }); } } }
    model.traverse((o) => {
      if (o.userData && o.userData.kl_part) parts.push(o);
      // 안경은 캐릭터마다 눈 위치가 달라 모양을 따로 가진다(복제본끼리 같은 geometry를 같이 쓰므로 복사)
      if (o.isMesh && o.userData && o.userData.kl_type === 'glasses' && GLASS_REF[style]) { o.geometry = o.geometry.clone(); o.userData.basePos = o.geometry.attributes.position.array.slice(); }
      if (o.isMesh) {
        o.castShadow = true; o.frustumCulled = false;   // 뼈로 움직여서 화면 밖 판정이 틀릴 수 있음
        const n = o.material && o.material.name || '';
        if (/^TINT_|^MAT_av_skin/.test(n)) { o.material = o.material.clone(); o.material.userData.tint = /^TINT_/.test(n); if (/^MAT_av_skin/.test(n)) skinMats.push(o.material); }
        if (style === 'chibi' && /^MAT_av_skin/.test(n)) o.material.emissiveIntensity = SKIN_GLOW;
        // 옷·머리카락은 피부보다 1~2cm 위에 겹쳐 있어, 멀리서 보면 화면이 어느 쪽을 앞에 그릴지 헷갈려 옷이 번쩍이며 사라졌다(z-fighting) →
        // 옷·머리 재질은 깊이 계산에서 살짝 앞으로 당겨 늘 피부보다 앞에 그리게 한다
        if (/^TINT_|^FIX_/.test(n)) { if (!o.material.userData.tint && !/^MAT_av_skin/.test(n)) o.material = o.material.clone(); o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -4; }
        if (/^MAT_av_face/.test(n)) {
          o.material = o.material.clone(); o.material.map = faceTex; o.material.color.set('#ffffff');
          if (style === 'chibi') { o.material.emissive = new THREE.Color('#ffffff'); o.material.emissiveMap = faceTex; o.material.emissiveIntensity = SKIN_GLOW; }
          o.material.needsUpdate = true;
          // 얼굴 UV를 FACE_ZOOM배로 넓힌다(복제본끼리 같은 geometry를 같이 쓰므로 파일당 한 번만)
          const z = FACE_ZOOM[style], uv = o.geometry.attributes.uv;
          if (z && uv && o.geometry.userData.faceZoom !== z) {
            for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * z, 0.5 + (uv.getY(i) - 0.5) * z);
            uv.needsUpdate = true; o.geometry.userData.faceZoom = z;
          }
        }
        if (o.morphTargetDictionary) morphMeshes.push(o);
      }
    });
    self.mixer = new THREE.AnimationMixer(model);
    // 두 그림체가 뼈 이름이 같아서 파일에 다른 그림체 동작도 같이 들어 있다 → 자기 그림체(style_) 동작을 우선
    for (const clip of gltf.animations) {
      const m = clip.name.match(/^([a-z]+)_(.+)$/); if (!m || !ACT[m[2]]) continue;
      if (m[1] === style || !self.actions[m[2]]) self.actions[m[2]] = self.mixer.clipAction(clip);
    }
    if (self.actions.wave) self.actions.wave.setLoop(THREE.LoopRepeat, 2);
    if (self.actions.dance) self.actions.dance.setLoop(THREE.LoopRepeat, 3);
    self.mixer.addEventListener('finished', (e) => { if (e.action === self.actions.wave || e.action === self.actions.dance) { busy = null; self.play('idle'); } });
    self.ready = true; self.setLook(self.look); self.play('idle', 0);
    self.onReady && self.onReady(self);
    }).catch((e) => console.error('avatar load', e));
  }
  mount(self.look.style);
  return self;
}
