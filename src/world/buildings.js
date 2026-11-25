import { real, N, P } from '../course/index.js';
import * as THREE from 'three';
import { V3 } from './shared.js';
import { rnd } from '../util/noise.js';
import { canvas2d } from '../util/dom.js';
import { MAX_ANISO, scene } from './renderer.js';
import { meshH } from './terrain.js';
import './pines.js';

/* ---------- buildings, hedges and walls (real courses) ---------- */
if (real && real.osm.buildings.length) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), sc = new V3(), ps = new V3(), col = new THREE.Color();
  const speck = (g, w, h, base, spread, n) => { for (let i = 0; i < n; i++) { const l = base + (rnd() - 0.5) * spread | 0; g.fillStyle = `rgba(${l},${l - 4},${l - 14},0.5)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 1 + rnd() * 2); } };
  // one bay of wall with one window; repeated across each wall so windows are never cut in half
  const [wc, wg] = canvas2d(128, 128);
  wg.fillStyle = '#d9d2c2'; wg.fillRect(0, 0, 128, 128); speck(wg, 128, 128, 205, 50, 900);
  wg.fillStyle = '#efebe0'; wg.fillRect(40, 30, 48, 64);
  wg.fillStyle = '#27303a'; wg.fillRect(44, 34, 40, 56);
  wg.fillStyle = '#efebe0'; wg.fillRect(63, 34, 2, 56); wg.fillRect(44, 61, 40, 2); wg.fillRect(36, 94, 56, 5);
  const wallMap = new THREE.CanvasTexture(wc); wallMap.wrapS = wallMap.wrapT = THREE.RepeatWrapping; wallMap.colorSpace = THREE.SRGBColorSpace; wallMap.anisotropy = MAX_ANISO;
  const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.95 });
  wallMat.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_INSTANCING
        float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz), sz = length(instanceMatrix[2].xyz);
        vMapUv = uv * vec2(max(1., floor((abs(normal.x) > 0.5 ? sz : sx) / 3.4 + 0.5)), max(1., floor(sy / 2.8 + 0.5)));
      #endif`);
  };
  const hip = new THREE.BufferGeometry();          // a hipped roof: four slopes up to a short ridge
  hip.setAttribute('position', new THREE.Float32BufferAttribute([
    -.5, 0, -.5, -.25, 1, 0, .25, 1, 0,   -.5, 0, -.5, .25, 1, 0, .5, 0, -.5,
    -.5, 0, .5, .5, 0, .5, .25, 1, 0,     -.5, 0, .5, .25, 1, 0, -.25, 1, 0,
    -.5, 0, -.5, -.5, 0, .5, -.25, 1, 0,   .5, 0, .5, .5, 0, -.5, .25, 1, 0], 3));
  hip.computeVertexNormals();
  const B = real.osm.buildings, box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const walls = new THREE.InstancedMesh(box, wallMat, B.length), pitched = new THREE.InstancedMesh(hip, roofMat, B.length), flat = new THREE.InstancedMesh(box, roofMat, B.length);
  let np = 0, nf = 0, nw = 0;
  const SHOW_TOWN = false;     // 19th-century Leckhampton: a village among fields, so the modern town is left out
  const KEEP_OUT = 150;        // simple house shapes only hold up at a distance, so none are drawn near the road
  const farFromRoad = (x, z) => { for (let k = 0; k < N; k += 8) { const ex = P[k].x - x, ez = P[k].z - z; if (ex * ex + ez * ez < KEEP_OUT * KEEP_OUT) return false; } return true; };
  B.forEach(([x, z, w, d, ang, h, roof]) => {
    if (!SHOW_TOWN || !farFromRoad(x, z)) return;
    const i = nw++;
    const c = Math.cos(ang), sn = Math.sin(ang);
    let lo = 1e9, hi = -1e9;
    for (const [u, v] of [[0, 0], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]]) { const y = meshH(x + u * c - v * sn, z + u * sn + v * c); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    q.setFromAxisAngle(up, -ang);
    walls.setMatrixAt(i, m4.compose(ps.set(x, lo - 0.4, z), q, sc.set(w, h + hi - lo + 0.4, d)));
    walls.setColorAt(i, col.setHSL(0.1, 0.2, 0.56 + rnd() * 0.08));                // one muted stone, so the town reads as a single mass
    const slate = col.setHSL(0.6, 0.06, 0.2 + rnd() * 0.06);
    if (roof) { pitched.setMatrixAt(np, m4.compose(ps.set(x, hi + h, z), q, sc.set(w + 0.8, Math.min(3.4, d * 0.34), d + 0.8))); pitched.setColorAt(np++, slate); }
    else { flat.setMatrixAt(nf, m4.compose(ps.set(x, hi + h, z), q, sc.set(w + 0.3, 0.3, d + 0.3))); flat.setColorAt(nf++, slate); }
  });
  walls.count = nw; pitched.count = np; flat.count = nf;
  for (const m of [walls, pitched, flat]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }

  // hedges and dry-stone walls, laid in short pieces that follow the ground
  const [hc, hg] = canvas2d(64, 64); hg.fillStyle = '#263a17'; hg.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 500; i++) { const l = 30 + rnd() * 50 | 0; hg.fillStyle = `rgb(${l * 0.7 | 0},${l + 20},${l * 0.4 | 0})`; hg.fillRect(rnd() * 64, rnd() * 64, 2 + rnd() * 3, 2 + rnd() * 3); }
  const [sc2, sg] = canvas2d(64, 64); sg.fillStyle = '#9c927c'; sg.fillRect(0, 0, 64, 64); speck(sg, 64, 64, 150, 90, 500);
  const tex = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const L = real.osm.lines, kinds = [
    new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ map: tex(hc), roughness: 1 }), L.length),
    new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ map: tex(sc2), roughness: 1 }), L.length)], n = [0, 0];
  for (const [x1, z1, x2, z2, kind] of L) {
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, len = Math.hypot(x2 - x1, z2 - z1);
    q.setFromAxisAngle(up, -Math.atan2(z2 - z1, x2 - x1));
    kinds[kind].setMatrixAt(n[kind]++, m4.compose(ps.set(mx, meshH(mx, mz) - 0.5, mz), q, kind ? sc.set(len + 0.3, 1.6, 0.55) : sc.set(len + 0.5, 2.1 + rnd() * 0.3, 1.3 + rnd() * 0.3)));
  }
  kinds.forEach((m, k) => { m.count = n[k]; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); });
}
