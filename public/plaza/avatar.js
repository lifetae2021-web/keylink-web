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
export function drawFace(cv, look) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), k = W / 1024;
  const P = (lon, lat) => [W * (0.5 + lon / 360), H * (0.5 - lat / 180)];
  g.fillStyle = look.colors.skin; g.fillRect(0, 0, W, H);
  const es = 1 + 0.28 * look.eyeSize, gap = 17 + 4 * look.eyeGap, ey = -6 + 5 * look.eyeY;
  const ink = '#2b2020', brow = new THREE.Color(look.colors.hair).multiplyScalar(0.7).getStyle();
  // 볼터치
  if (look.blush > 0) {
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
    g.fillStyle = look.eye === 'round' ? ink : look.colors.eyeColor; g.fillRect(x - rx * 1.6, y - ry * 1.6, rx * 3.2, ry * 3.2);
    if (look.eye !== 'round') { g.fillStyle = ink; g.beginPath(); g.ellipse(x, y + 2 * k, rx * 0.55, ry * 0.6, 0, 0, Math.PI * 2); g.fill(); }
    if (look.eye === 'sleepy') { g.fillStyle = look.colors.skin; g.fillRect(x - rx * 2, y - ry * 2, rx * 4, ry * 1.55); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4 * k * es, y - (look.eye === 'sleepy' ? -4 : 8) * k * es, 4.5 * k * es, 0, Math.PI * 2); g.fill();
    if (look.eye === 'sparkle') { g.beginPath(); g.arc(x - 4 * k * es, y + 7 * k * es, 2.5 * k * es, 0, Math.PI * 2); g.fill(); }
    g.restore();
    if (look.eye === 'sleepy') { g.strokeStyle = ink; g.lineWidth = 4 * k; g.beginPath(); g.moveTo(x - rx, y - ry * 0.45); g.lineTo(x + rx, y - ry * 0.45); g.stroke(); }
  }
  // 눈썹
  g.strokeStyle = brow; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const [x, y] = P(s * (gap + 1), ey + 15 + 2 * look.eyeSize), w = 17 * k;
    g.lineWidth = (look.brow === 'thick' ? 8 : 4.5) * k; g.beginPath();
    if (look.brow === 'straight') { g.moveTo(x - w, y); g.lineTo(x + w, y); }
    else if (look.brow === 'arched') { g.moveTo(x - w, y + 3 * k); g.quadraticCurveTo(x + s * 2 * k, y - 9 * k, x + w, y + 3 * k); }
    else { g.moveTo(x - w, y + 2 * k); g.quadraticCurveTo(x, y - 4 * k, x + w, y + 2 * k); }
    g.stroke();
  }
  // 입
  const [mx, my] = P(0, ey - 15); g.strokeStyle = '#9a4a4a'; g.lineWidth = 4 * k; g.beginPath();
  if (look.mouth === 'grin') { g.fillStyle = '#b2484f'; g.moveTo(mx - 12 * k, my - 3 * k); g.quadraticCurveTo(mx, my + 16 * k, mx + 12 * k, my - 3 * k); g.closePath(); g.fill(); }
  else if (look.mouth === 'small') { g.arc(mx, my, 4 * k, 0, Math.PI * 2); g.stroke(); }
  else if (look.mouth === 'cat') { g.moveTo(mx - 11 * k, my - 2 * k); g.quadraticCurveTo(mx - 5.5 * k, my + 6 * k, mx, my - 1 * k); g.quadraticCurveTo(mx + 5.5 * k, my + 6 * k, mx + 11 * k, my - 2 * k); g.stroke(); }
  else if (look.mouth === 'neutral') { g.moveTo(mx - 8 * k, my); g.lineTo(mx + 8 * k, my); g.stroke(); }
  else { g.arc(mx, my - 6 * k, 10 * k, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
}

const ACT = { idle: 'idle', walk: 'walk', wave: 'wave', sit: 'sit', dance: 'dance' };
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
  let model = null, parts = [], morphMeshes = [], skinMats = [], busy = null, hearts = [];
  self.setLook = (raw) => {
    self.look = sanitizeLook(raw); const L = self.look;
    if (mounted && L.style !== mounted) { mount(L.style); }
    drawFace(cv, L); faceTex.needsUpdate = true;
    if (!model) return;
    const vis = visibleParts(L);
    for (const o of parts) {
      const u = o.userData, want = u.kl_part === 'acc' ? vis.acc.includes(u.kl_type) : vis[u.kl_part] === u.kl_type; o.visible = want;
      if (want && o.material && o.material.userData.tint) o.material.color.set(L.colors[u.kl_part === 'hair' ? 'hair' : u.kl_part]);
    }
    for (const m of skinMats) m.color.set(L.colors.skin);
    const mv = { build_slim: Math.max(0, -L.build), build_broad: Math.max(0, L.build), female: L.female, face_long: L.long, face_vline: L.vline, cheek_full: L.cheek };
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
  self.update = (dt, moving) => {
    for (const h of [...hearts]) { const u = h.userData; u.t += dt; if (u.t < 0) { h.visible = false; continue; } h.visible = true;
      h.position.y += dt * 0.7; h.position.x += u.vx * dt; h.material.opacity = Math.max(0, 1 - u.t / 1.6);
      if (u.t > 1.6) { group.remove(h); h.material.dispose(); hearts.splice(hearts.indexOf(h), 1); } }
    if (!self.mixer) return;
    if (moving) { busy = null; self.play('walk'); }
    else if (!busy) self.play('idle');
    self.mixer.update(dt);
  };
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
    model.traverse((o) => {
      if (o.userData && o.userData.kl_part) parts.push(o);
      if (o.isMesh) {
        o.castShadow = true; o.frustumCulled = false;   // 뼈로 움직여서 화면 밖 판정이 틀릴 수 있음
        const n = o.material && o.material.name || '';
        if (/^TINT_|^MAT_av_skin/.test(n)) { o.material = o.material.clone(); o.material.userData.tint = /^TINT_/.test(n); if (/^MAT_av_skin/.test(n)) skinMats.push(o.material); }
        if (/^MAT_av_face/.test(n)) { o.material = o.material.clone(); o.material.map = faceTex; o.material.color.set('#ffffff'); o.material.needsUpdate = true; }
        if (o.morphTargetDictionary) morphMeshes.push(o);
      }
    });
    self.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) { const key = clip.name.replace(/^[a-z]+_/, ''); if (ACT[key]) self.actions[key] = self.mixer.clipAction(clip); }
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
