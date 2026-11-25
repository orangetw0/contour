/* What a rider wears that isn't cloth: helmet, glasses and shoes. Each is built in code to fit the rider's own
   head and feet, measured from their mesh, and is carried by the head or foot bone. */
import * as THREE from 'three';
import { FOOT } from './kit.js';

const V3 = THREE.Vector3, hex = c => '#' + new THREE.Color(c).getHexString();
const attach = (mesh, bone) => { mesh.castShadow = true; mesh.updateMatrix(); mesh.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert()); bone.add(mesh); };

// the shell's paint, seen from above: body colour, a rear flash, and long dark vents running front to back
function helmetTexture(kit) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), px = v => (v * 0.5 + 0.5) * S;            // unit coords: x across, z front (+1) to back (-1)
  g.fillStyle = hex(kit.jersey); g.fillRect(0, 0, S, S);
  g.fillStyle = hex(kit.trim); g.beginPath(); g.moveTo(px(-0.8), px(0.45)); g.lineTo(px(0), px(0.1)); g.lineTo(px(0.8), px(0.45)); g.lineTo(px(0.8), px(1)); g.lineTo(px(-0.8), px(1)); g.fill();   // rear flash (z is flipped below)
  g.fillStyle = '#08080a';
  const slot = (x, z0, z1, w) => { g.beginPath(); g.roundRect(px(x) - w / 2, px(-z1), w, px(-z0) - px(-z1), w / 2); g.fill(); };
  for (const [x, w] of [[0, 30], [-0.3, 26], [0.3, 26], [-0.58, 20], [0.58, 20]]) { slot(x * 0.92, 0.12, 0.74 - Math.abs(x) * 0.5, w); slot(x, -0.62 + Math.abs(x) * 0.3, -0.02, w); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// a helmet shell: an egg shape, longer at the back, whose rim sits at the brow in front, clears the ears and
// drops down behind to cover the back of the head
function helmetShell(rx, ry, rz) {
  const seg = 44, rows = 16, pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= seg; j++) {
    const phi = j / seg * Math.PI * 2, c = Math.cos(phi), s = Math.sin(phi);
    const rim = c > 0 ? -0.3 + 0.3 * c * c : -0.3 - 0.34 * c * c;                // how low the rim comes at this point round the head
    const th = i / rows * (Math.PI / 2 - Math.asin(rim)), st = Math.sin(th), d = [st * s, Math.cos(th), st * c];
    pos.push(d[0] * rx, d[1] * ry * (1 - 0.06 * st * st * Math.max(0, c)), d[2] * rz * (c < 0 ? 1.1 : 1));
    uv.push(d[0] * 0.5 + 0.5, d[2] * 0.5 + 0.5);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* Helmet and glasses. head: { skull (Box3 of the head above the brow), brow (y), eyes (Box3), ear (y) } measured from
   the mesh at rest. */
export function addHeadGear(headBone, head, kit) {
  const { skull, brow, eyes } = head, c = skull.getCenter(new V3()), size = skull.getSize(new V3());
  const at = new V3(c.x, brow - 0.006, c.z - 0.004), rx = size.x / 2 + 0.026, ry = skull.max.y - at.y + 0.03, rz = size.z / 2 + 0.032;
  const rimAt = (phi, out = new V3()) => { const co = Math.cos(phi), rim = co > 0 ? -0.3 + 0.3 * co * co : -0.3 - 0.34 * co * co, st = Math.cos(Math.asin(rim)); return out.set(at.x + st * Math.sin(phi) * rx * 0.97, at.y + rim * ry, at.z + st * co * rz * 0.97); };
  const shell = helmetShell(rx, ry, rz);
  const lid = new THREE.Mesh(shell, new THREE.MeshPhysicalMaterial({ map: helmetTexture(kit), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
  lid.position.copy(at); attach(lid, headBone);
  const liner = new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.9, side: THREE.BackSide }));     // the dark inside, so the rim has thickness
  liner.scale.setScalar(0.94); liner.position.copy(at); attach(liner, headBone);
  // straps: from the shell in front of and behind each ear, meeting below it, then on toward the chin
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.8 });
  const strap = (a, b) => { const d = new V3().subVectors(b, a), m = new THREE.Mesh(new THREE.BoxGeometry(0.0022, d.length(), 0.009), dark); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); attach(m, headBone); };
  for (const s of [-1, 1]) {
    const under = new V3(c.x + s * (size.x / 2 + 0.004), eyes.min.y - 0.07, c.z - 0.004);
    strap(rimAt(s * 1.05), under); strap(rimAt(s * 2.1), under);
    strap(under, new V3(c.x + s * size.x * 0.36, eyes.min.y - 0.112, c.z + size.z * 0.2));
  }
  // glasses: one wrap-round lens, deepest under each eye and cut away over the nose, with arms back to the ears
  const ey = (eyes.min.y + eyes.max.y) / 2, r = size.x / 2 + 0.016, cz = eyes.max.z + 0.027 - r, A = 1.2, n = 28, pos = [], idx = [];
  for (let j = 0; j <= n; j++) {
    const a = -A + 2 * A * j / n, k = Math.abs(a) / A, depth = 0.011 + 0.026 * Math.sin(Math.min(1, k * 1.9) * Math.PI) ** 0.7 * (1 - 0.45 * k);
    const x = c.x + Math.sin(a) * r, z = cz + Math.cos(a) * r * (1 - 0.1 * k * k);
    pos.push(x, ey + 0.021 - 0.006 * k, z, x, ey + 0.021 - 0.006 * k - depth - 0.011, z - 0.004);
    if (j < n) idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 2, j * 2 + 1, j * 2 + 3);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setIndex(idx); lg.computeVertexNormals();
  attach(new THREE.Mesh(lg, new THREE.MeshPhysicalMaterial({ color: 0x18110d, roughness: 0.08, metalness: 0.85, clearcoat: 1, side: THREE.DoubleSide })), headBone);
  for (const s of [-1, 1]) {
    const end = new V3(c.x + Math.sin(s * A) * r, ey + 0.015, cz + Math.cos(A) * r * 0.9), d = new V3(c.x + s * (size.x / 2 + 0.008), ey + 0.012, c.z - 0.015).sub(end);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.007, d.length()), dark); arm.position.copy(end).addScaledVector(d, 0.5); arm.quaternion.setFromUnitVectors(new V3(0, 0, 1), d.normalize()); attach(arm, headBone);
  }
}

/* Shoes: a road shoe lofted round each foot from the foot's own measurements, so it fits snugly: a stiff dark sole,
   a white upper that closes round the ankle, a coloured heel and a dial on the outside. */
export function addShoes(body, bones, names, ankleY, kit) {
  const pos = body.geometry.attributes.position, si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight, pts = [], p = new V3(), box = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (FOOT.test(names[si.getComponent(i, k)])) w += sw.getComponent(i, k);
    p.fromBufferAttribute(pos, i); if (w > 0.5 && p.x > 0 && p.y < ankleY + 0.01) { pts.push(p.clone()); box.expandByPoint(p); }
  }
  const cx = (box.min.x + box.max.x) / 2, sole = box.min.y, z0 = box.min.z - 0.006, z1 = box.max.z + 0.004, N = 11, M = 14, vp = [], col = [], idx = [];
  const upper = new THREE.Color(0xf4f4f2), dark = new THREE.Color(0x0a0a0c), heel = new THREE.Color(kit.jersey);
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1), z = z0 + (z1 - z0) * f;
    let hw = 0.012, top = sole + 0.03;                              // the foot's half-width and height in this slice
    for (const q of pts) if (Math.abs(q.z - z) < 0.022) { hw = Math.max(hw, Math.abs(q.x - cx)); top = Math.max(top, q.y); }
    const ends = Math.sin(Math.min(1, Math.min(f, 1 - f) * 5) * Math.PI / 2) ** 0.6;        // round off the heel and toe
    hw = (hw + 0.005) * (0.68 + 0.32 * ends); top = Math.min(top + 0.006, ankleY - 0.004) - (1 - ends) * 0.012 * (f > 0.5 ? 1.2 : 0.3);
    for (let k = 0; k < M; k++) {
      const a = k / M * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), under = sn < -0.25;
      vp.push(cx + hw * Math.sign(cs) * Math.abs(cs) ** 0.7 * (under ? 0.92 : 1), under ? sole - 0.007 + 0.004 * (1 - ends) : sole + 0.004 + (top - sole - 0.004) * Math.max(0, sn) ** 0.75 + (sn < 0 ? sn * 0.02 : 0), z);
      (under || (sn < 0.2 && sn >= -0.25) ? dark : f < 0.16 && sn > 0.05 ? heel : upper).toArray(col, col.length);
    }
  }
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < M; k++) { const a = i * M + k, b = i * M + (k + 1) % M; idx.push(a, b, a + M, b, b + M, a + M); }
  for (const [o, flip] of [[0, true], [(N - 1) * M, false]]) for (let k = 1; k < M - 1; k++) idx.push(o, flip ? o + k + 1 : o + k, flip ? o + k : o + k + 1);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 }), dialMat = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.4, metalness: 0.4 });
  const dialZ = z0 + (z1 - z0) * 0.55; let dialY = sole + 0.05, dialX = 0.03;
  for (const q of pts) if (Math.abs(q.z - dialZ) < 0.02 && q.x > cx) { dialY = Math.max(dialY, q.y * 0.5 + sole * 0.5 + 0.022); dialX = Math.max(dialX, q.x - cx); }
  for (const side of [1, -1]) {
    const shoe = new THREE.Mesh(geo, mat), bone = bones[side > 0 ? 'foot_l' : 'foot_r'];
    if (side < 0) { shoe.scale.x = -1; mat.side = THREE.DoubleSide; }                    // the right shoe is the left one mirrored
    attach(shoe, bone);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.007, 14), dialMat);
    dial.rotation.z = Math.PI / 2 - side * 0.5; dial.position.set(side * (cx + dialX * 0.9), dialY, dialZ); attach(dial, bone);
  }
}
