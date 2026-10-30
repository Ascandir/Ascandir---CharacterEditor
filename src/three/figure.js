// Procedural 3D figure for the kit designer. Same parameters, different render styles.
import * as THREE from 'three';

let toonGradient = null;
function gradient() {
  if (toonGradient) return toonGradient;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  toonGradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  toonGradient.minFilter = THREE.NearestFilter; toonGradient.magFilter = THREE.NearestFilter; toonGradient.needsUpdate = true;
  return toonGradient;
}

function makeMat(style, color, { metal = false, rough = 0.8 } = {}) {
  const c = new THREE.Color(color);
  switch (style) {
    case 'comic': return new THREE.MeshToonMaterial({ color: c, gradientMap: gradient() });
    case 'painted': {
      const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, Math.min(1, hsl.s * 1.15), Math.min(0.85, hsl.l * 1.05));
      return new THREE.MeshLambertMaterial({ color: c });
    }
    case 'miniature': return new THREE.MeshStandardMaterial({ color: metal ? 0xb5b5b5 : 0x9c9c9c, roughness: 0.55, metalness: metal ? 0.35 : 0.05 });
    default: return new THREE.MeshStandardMaterial({ color: c, roughness: metal ? 0.35 : rough, metalness: metal ? 0.85 : 0.0 });
  }
}

export function buildFigure(a) {
  const style = a.style || 'painted';
  const H = (a.height || 180) / 100;
  const w = 0.85 + (a.build ?? 45) * 0.006;
  const m = 0.9 + (a.muscle ?? 50) * 0.003;
  const old = Math.max(0, ((a.age ?? 30) - 55) / 35);
  const g = new THREE.Group();
  const meshes = [];
  const M = {
    skin: makeMat(style, a.skin || '#c99a76', { rough: 0.7 }),
    cloth: makeMat(style, a.primary || '#7a2e2e'),
    pants: makeMat(style, '#3c3a36'),
    leather: makeMat(style, '#6b4a2e'),
    metal: makeMat(style, '#9aa3ad', { metal: true }),
    dark: makeMat(style, '#2b2b2b'),
    hair: makeMat(style, old > 0.4 ? '#bdbdbd' : (a.hairColor || '#3b2a1e')),
    wood: makeMat(style, '#7a5a38'),
    horn: makeMat(style, '#e6dcc4'),
  };
  const add = (geo, mat, x, y, z, parent = g) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); parent.add(me); meshes.push(me); return me; };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14);
  const sph = (r) => new THREE.SphereGeometry(r, 20, 14);

  // legs
  const hipY = 0.5 * H; const thigh = 0.245 * H; const shin = 0.225 * H;
  const legR = 0.046 * H * w * m; const shinR = legR * 0.78;
  for (const s of [-1, 1]) {
    const x = s * 0.052 * H * w;
    add(cap(legR, thigh - legR * 2), M.pants, x, hipY - thigh / 2, 0);
    add(cap(shinR, shin - shinR * 2), M.pants, x, hipY - thigh - shin / 2 + 0.01, 0);
    const foot = add(new THREE.BoxGeometry(0.05 * H, 0.03 * H, 0.12 * H), M.dark, x, 0.015 * H, 0.03 * H);
    foot.geometry.translate(0, 0, 0);
  }
  // pelvis + torso
  add(new THREE.SphereGeometry(0.085 * H * w, 20, 14).scale(1.05, 0.62, 0.68), M.pants, 0, hipY + 0.01 * H, 0);
  const torso = new THREE.Group(); torso.position.set(0, hipY + 0.03 * H, 0); torso.rotation.x = old * 0.18; g.add(torso);
  const torsoLen = 0.27 * H; const torsoR = 0.072 * H * w;
  add(cap(torsoR, torsoLen - torsoR * 1.4).scale(1.3 * m, 1, 0.72), M.cloth, 0, torsoLen / 2, 0, torso);
  const armorKind = a.armor || 'none';
  if ((a.build ?? 45) > 60) add(sph(0.06 * H * ((a.build - 50) / 90 + 0.5)).scale(1.2, 1, 0.95), armorKind === 'leather' ? M.leather : (armorKind === 'chain' || armorKind === 'plate') ? M.metal : M.cloth, 0, torsoLen * 0.3, 0.04 * H * w, torso);
  // neck/head
  const headR = 0.062 * H;
  const neckY = torsoLen + 0.02 * H;
  add(cap(0.03 * H * m, 0.03 * H), M.skin, 0, neckY, 0, torso);
  const head = new THREE.Group(); head.position.set(0, neckY + headR + 0.02 * H, old * 0.02); torso.add(head);
  add(sph(headR).scale(0.92, 1.08, 1), M.skin, 0, 0, 0, head);
  // eyes
  for (const s of [-1, 1]) add(sph(headR * 0.12), M.dark, s * headR * 0.35, headR * 0.12, headR * 0.86, head);
  // head variants
  const kind = a.head || 'human';
  if (kind === 'elf') for (const s of [-1, 1]) { const e = add(new THREE.ConeGeometry(headR * 0.18, headR * 0.7, 8), M.skin, s * headR * 0.95, headR * 0.25, 0, head); e.rotation.z = -s * 1.1; }
  if (kind === 'orc') for (const s of [-1, 1]) { const tu = add(new THREE.ConeGeometry(headR * 0.08, headR * 0.3, 6), M.horn, s * headR * 0.3, -headR * 0.5, headR * 0.82, head); }
  if (kind === 'dragon') {
    const sn = add(new THREE.CylinderGeometry(headR * 0.32, headR * 0.6, headR * 1.0, 14), M.skin, 0, -headR * 0.25, headR * 0.85, head); sn.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(sph(headR * 0.08), M.dark, s * headR * 0.15, -headR * 0.05, headR * 1.33, head);
    for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(headR * 0.2, headR * 1.5, 10), M.horn, s * headR * 0.45, headR * 0.9, -headR * 0.75, head); h.rotation.x = -1.1; h.rotation.z = -s * 0.2; }
  }
  if (kind === 'horns') for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(headR * 0.13, headR * 0.9, 8), M.horn, s * headR * 0.5, headR * 0.95, -headR * 0.1, head); h.rotation.z = -s * 0.5; h.rotation.x = -0.4; }
  if (kind === 'beast') for (const s of [-1, 1]) { const e = add(new THREE.ConeGeometry(headR * 0.25, headR * 0.6, 4), M.hair, s * headR * 0.55, headR * 1.05, 0, head); e.rotation.z = -s * 0.3; }
  // hair
  const hs = a.hairStyle || 'short';
  if (hs !== 'none' && !a.helmet && kind !== 'dragon') {
    add(new THREE.SphereGeometry(headR * 1.04, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.hair, 0, headR * 0.12, -headR * 0.05, head);
    if (hs === 'long') add(cap(headR * 0.7, headR * 1.4).scale(1.2, 1, 0.55), M.hair, 0, -headR * 0.9, -headR * 0.6, head);
    if (hs === 'bun') add(sph(headR * 0.42), M.hair, 0, headR * 0.7, -headR * 0.85, head);
    if (hs === 'beard' || a.beard) { const b = add(new THREE.ConeGeometry(headR * 0.55, headR * 0.9, 12), M.hair, 0, -headR * 0.9, headR * 0.55, head); b.rotation.x = Math.PI; }
  }
  if (a.helmet) add(new THREE.SphereGeometry(headR * 1.12, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.metal, 0, headR * 0.08, 0, head);
  // arms
  const shoulderX = 0.105 * H * (0.8 + w * 0.2) * m;
  const upper = 0.175 * H; const lower = 0.155 * H; const armR = 0.03 * H * m * (0.85 + w * 0.15);
  const hands = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * shoulderX, torsoLen * 0.9, 0); sh.rotation.z = s * 0.1; torso.add(sh);
    add(cap(armR, upper - armR * 2), M.cloth, 0, -upper / 2, 0, sh);
    const el = new THREE.Group(); el.position.set(0, -upper, 0); el.rotation.x = s > 0 ? -0.35 : -0.1; sh.add(el);
    add(cap(armR * 0.85, lower - armR * 2), M.skin, 0, -lower / 2, 0, el);
    add(sph(armR * 1.05), M.skin, 0, -lower - armR * 0.6, 0, el);
    hands[s] = { group: el, y: -lower - armR * 0.6 };
  }
  // armor
  const armor = a.armor || 'none';
  if (armor === 'robe') { const rb = add(new THREE.ConeGeometry(0.16 * H * w, 0.56 * H, 24, 1, true), M.cloth, 0, 0.3 * H, 0); rb.material = rb.material.clone(); rb.material.side = THREE.DoubleSide; }
  if (armor === 'leather' || armor === 'chain' || armor === 'plate') {
    const mat = armor === 'leather' ? M.leather : M.metal;
    add(cap(torsoR * 1.08, torsoLen * 0.55).scale(1.3 * m, 1, 0.76), mat, 0, torsoLen * 0.55, 0, torso);
    for (const s of [-1, 1]) add(sph(armR * (armor === 'plate' ? 1.8 : 1.4)).scale(1.1, 0.7, 1), mat, s * shoulderX, torsoLen * 0.92, 0, torso);
    if (armor !== 'leather') { const sk = add(new THREE.CylinderGeometry(0.085 * H * w, 0.11 * H * w, 0.12 * H, 18, 1, true), mat, 0, hipY - 0.04 * H, 0); sk.material = sk.material.clone(); sk.material.side = THREE.DoubleSide; }
    if (armor === 'plate') for (const s of [-1, 1]) add(cap(shinR * 1.2, shin * 0.6), M.metal, s * 0.055 * H * w, hipY - thigh - shin / 2, 0);
  }
  if (a.cape) {
    const cp = add(new THREE.CylinderGeometry(0.1 * H * w * m, 0.2 * H * w, 0.66 * H, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9), M.cloth, 0, hipY + 0.02 * H, -0.01 * H);
    cp.material = cp.material.clone(); cp.material.side = THREE.DoubleSide;
  }
  // weapon right hand
  const rh = hands[1]; const lh = hands[-1];
  const wpn = a.weapon || 'none';
  if (wpn === 'sword') {
    add(new THREE.BoxGeometry(0.012 * H, 0.42 * H, 0.03 * H), M.metal, 0, rh.y - 0.2 * H, 0.03 * H, rh.group).rotation.x = 0;
    add(new THREE.BoxGeometry(0.02 * H, 0.015 * H, 0.1 * H), M.dark, 0, rh.y - 0.005 * H, 0.03 * H, rh.group);
  }
  if (wpn === 'axe') {
    add(new THREE.CylinderGeometry(0.008 * H, 0.008 * H, 0.42 * H, 8), M.wood, 0, rh.y - 0.15 * H, 0.03 * H, rh.group);
    add(new THREE.BoxGeometry(0.01 * H, 0.09 * H, 0.1 * H), M.metal, 0, rh.y - 0.33 * H, 0.08 * H, rh.group);
  }
  if (wpn === 'staff') add(new THREE.CylinderGeometry(0.01 * H, 0.012 * H, 0.95 * H, 8), M.wood, 0, rh.y + 0.1 * H, 0.03 * H, rh.group);
  if (wpn === 'bow') { const b = add(new THREE.TorusGeometry(0.28 * H, 0.008 * H, 6, 24, Math.PI * 0.9), M.wood, 0, lh.y, 0.05 * H, lh.group); b.rotation.z = Math.PI / 2 + 0.15; b.rotation.y = Math.PI / 2; }
  if (wpn === 'dagger') add(new THREE.BoxGeometry(0.01 * H, 0.14 * H, 0.025 * H), M.metal, 0, rh.y - 0.07 * H, 0.03 * H, rh.group);
  if (a.shield) { const sh = add(new THREE.CylinderGeometry(0.13 * H, 0.13 * H, 0.015 * H, 24), M.metal, -0.03 * H, lh.y + 0.08 * H, 0.02 * H, lh.group); sh.rotation.z = Math.PI / 2; }
  // base for miniature style
  if (style === 'miniature') add(new THREE.CylinderGeometry(0.2 * H, 0.21 * H, 0.03 * H, 32), makeMat(style, '#333', {}), 0, -0.012 * H, 0);
  // comic outline (inverted hull)
  if (style === 'comic') {
    const outline = new THREE.MeshBasicMaterial({ color: 0x14110f, side: THREE.BackSide });
    for (const me of meshes) {
      if (me.geometry.type === 'PlaneGeometry' || me.geometry.parameters?.openEnded) continue;
      const o = new THREE.Mesh(me.geometry, outline);
      o.scale.setScalar(1.06);
      me.add(o);
    }
  }
  g.userData.height = H;
  g.userData.headY = hipY + 0.03 * H + neckY + headR + 0.02 * H;
  return g;
}
