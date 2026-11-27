import { real, demH, nearRoad, N, P, R, T } from '../course/index.js';
import * as THREE from 'three';
import { V3, st0 } from './shared.js';
import { smooth, rnd } from '../util/noise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d } from '../util/dom.js';
import { TS, TC, TG, TW, tPos, tCol, meshH } from './terrain.js';
import { scene } from './renderer.js';
import { LOOK } from './look.js';
import './verge.js';

/* ---------- 19th-century touches (real courses): sheep on the hill, hay stooks in the vale ---------- */
const stamps = [];       // patches where the meadow is grazed short or cut to stubble
if (real && real.pastoral) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), sc = new V3(), ps = new V3(), col = new THREE.Color();
  const open = (x, z) => Math.abs(x) < TS / 2 - 60 && Math.abs(z) < TS / 2 - 60 && !real.wood(x, z);
  const slopeAt = (x, z) => Math.hypot(demH(x + 10, z) - demH(x - 10, z), demH(x, z + 10) - demH(x, z - 10)) / 20;
  const roadGap = (x, z) => { const nr = nearRoad(x, z); return nr ? nr.d : 999; };
  const tint = (x, z, r, c) => {                      // recolour the ground around a point
    const i0 = Math.round((x + TS / 2) / TC), j0 = Math.round((z + TS / 2) / TC), n = Math.ceil(r / TC);
    for (let j = j0 - n; j <= j0 + n; j++) for (let i = i0 - n; i <= i0 + n; i++) {
      if (i < 0 || j < 0 || i > TG || j > TG) continue;
      const k = j * TW + i, f = smooth(r, r * 0.6, Math.hypot(tPos[k * 3] - x, tPos[k * 3 + 2] - z));
      for (let a = 0; a < 3; a++) tCol[k * 3 + a] += (c[a] - tCol[k * 3 + a]) * f;
    }
  };
  const paint = (g, r, gg, b) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([r, gg, b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const place = (geo, mat, spots, fn) => {
    const m = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach(([x, z], i) => { fn(x, z); m.setMatrixAt(i, m4.compose(ps, q, sc)); m.setColorAt(i, col); });
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
  };

  // flocks on the high ground
  const sheep = [];
  for (let n = 0; n < 5000 && stamps.length < 46; n++) {
    const i = Math.floor(rnd() * N);
    if (P[i].y < 175) continue;
    const off = (rnd() < 0.5 ? -1 : 1) * (30 + rnd() * 65), x = P[i].x + R[i].x * off, z = P[i].z + R[i].z * off;
    if (!open(x, z) || roadGap(x, z) < 24 || slopeAt(x, z) > 0.3 || stamps.some(s => Math.hypot(s.x - x, s.z - z) < 70)) continue;
    stamps.push({ x, z, r: 48, amt: 0.36 });
    for (let k = 0, c = 6 + rnd() * 9; k < c; k++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 24, sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
      if (roadGap(sx, sz) > 10 && !real.wood(sx, sz)) sheep.push([sx, sz]);
    }
  }
  const sheepGeo = headY => mergeGeometries([
    paint(new THREE.SphereGeometry(0.5, 9, 7).scale(1.12, 0.76, 0.7).translate(0, 0.74, 0), 0.82, 0.78, 0.69),
    paint(new THREE.BoxGeometry(0.3, 0.24, 0.22).translate(0.66, headY, 0), 0.1, 0.09, 0.08),
    ...[[0.32, 0.19], [0.32, -0.19], [-0.32, 0.19], [-0.32, -0.19]].map(([x, z]) => paint(new THREE.BoxGeometry(0.08, 0.44, 0.08).translate(x, 0.22, z), 0.1, 0.09, 0.08))]);
  const woolMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const stand = (x, z) => { ps.set(x, meshH(x, z), z); q.setFromAxisAngle(up, rnd() * 6.283); const k = 1.1 + rnd() * 0.35; sc.set(k, k, k); col.setScalar(0.85 + rnd() * 0.15); };
  place(sheepGeo(0.4), woolMat, sheep.filter((_, i) => i % 3 !== 0), stand);      // grazing, heads down
  place(sheepGeo(0.86), woolMat, sheep.filter((_, i) => i % 3 === 0), stand);     // looking up

  // cut fields with rows of stooks in the vale
  const stooks = []; let fields = 0;
  for (let n = 0; n < 5000 && fields < 26; n++) {
    const i = Math.floor(rnd() * N);
    if (P[i].y > 150) continue;
    const off = (rnd() < 0.5 ? -1 : 1) * (48 + rnd() * 50), x = P[i].x + R[i].x * off, z = P[i].z + R[i].z * off;
    if (!open(x, z) || roadGap(x, z) < 40 || slopeAt(x, z) > 0.1 || stamps.some(s => Math.hypot(s.x - x, s.z - z) < 110)) continue;
    stamps.push({ x, z, r: 46, amt: 0.5 }); if (!LOOK.snowy) tint(x, z, 46, [1.5, 1.22, 0.6]); fields++;       // stubble shows gold, unless snow lies on it
    const a = Math.atan2(T[i].z, T[i].x), c = Math.cos(a), sn = Math.sin(a);
    for (let u = -3; u <= 3; u++) for (let v = -2; v <= 2; v++) {
      const du = u * 9 + (rnd() - 0.5) * 1.5, dv = v * 10 + (rnd() - 0.5) * 1.5, sx = x + du * c - dv * sn, sz = z + du * sn + dv * c;
      if (!real.wood(sx, sz) && roadGap(sx, sz) > 12) stooks.push([sx, sz]);
    }
  }
  const [stc, stg] = canvas2d(64, 64); stg.fillStyle = '#b8964a'; stg.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) { const l = 150 + rnd() * 80 | 0; stg.fillStyle = `rgb(${l},${l * 0.8 | 0},${l * 0.42 | 0})`; stg.fillRect(rnd() * 64, 0, 1 + rnd() * 1.5, 64); }
  const straw = new THREE.CanvasTexture(stc); straw.colorSpace = THREE.SRGBColorSpace;
  place(new THREE.ConeGeometry(0.62, 1.5, 7).translate(0, 0.75, 0), new THREE.MeshStandardMaterial({ map: straw, roughness: 1 }), stooks,
    (x, z) => { ps.set(x, meshH(x, z) - 0.05, z); q.setFromAxisAngle(up, rnd() * 6.283); sc.set(1.3 + rnd() * 0.5, 1.25 + rnd() * 0.45, 1.3 + rnd() * 0.5); col.setScalar(0.85 + rnd() * 0.15); });
  st0.sheep = sheep.length; st0.stooks = stooks.length; st0.fields = fields; st0.flocks = stamps.length - fields;
  st0.spots = stamps.map(s => [Math.round(s.x), Math.round(s.z), s.amt]);
}

export { stamps };
