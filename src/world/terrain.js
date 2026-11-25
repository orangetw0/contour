import { real, demH, nearRoad, XMAS } from '../course/index.js';
import { fbm, smooth, ridged } from '../util/noise.js';
import * as THREE from 'three';
import { sunFlat, sunDir, uSunAmt } from './sky.js';
import { imgTex, imgRock, imgGrass, imgGrassN } from './textures.js';
import { scene } from './renderer.js';

/* ---------- terrain ---------- */
function baseH(x, z) {
  if (real) return demH(x, z);
  const r = Math.hypot(x, z) || 1;
  let h = 40 + (fbm(x / 300 + 5, z / 300 + 9) - 0.5) * 110 + (fbm(x / 60, z / 60, 4) - 0.5) * 14;
  const gap = smooth(0.55, 0.95, (x * sunFlat.x + z * sunFlat.z) / r);   // valley opens toward the sun
  h += (ridged(x / 120 + 7, z / 120 + 3, 3) - 0.25) * 14;                                     // knolls and hollows on the near hills
  const mtn = smooth(720, 1500, r) * (1 - 0.92 * gap);
  h += mtn * (90 + fbm(x / 420 + 40, z / 420, 5) * 400 + ridged(x / 300 + 11, z / 300 + 5) * 300 + ridged(x / 75, z / 75, 3) * 55);
  return h;
}
function terrainH(x, z) {
  const b = baseH(x, z), n = nearRoad(x, z);
  if (!n) return b;
  const k = real ? smooth(6, 34, n.d) : smooth(9, 62, n.d);     // a real hillside keeps its shape closer to the road
  return (n.y - 0.6) * (1 - k) + b * k;
}
const TS = real ? real.size : 3200, TG = real ? real.cells : 400, TC = TS / TG, TW = TG + 1;
const H = new Float32Array(TW * TW);
const tPos = new Float32Array(TW * TW * 3), tUv = new Float32Array(TW * TW * 2), tCol = new Float32Array(TW * TW * 3);
for (let iz = 0; iz < TW; iz++) for (let ix = 0; ix < TW; ix++) {
  const x = -TS / 2 + ix * TC, z = -TS / 2 + iz * TC, k = iz * TW + ix, h = terrainH(x, z);
  H[k] = h; tPos.set([x, h, z], k * 3); tUv.set([x / 4, z / 4], k * 2);
}
const tIdx = new Uint32Array(TG * TG * 6);
for (let iz = 0, q = 0; iz < TG; iz++) for (let ix = 0; ix < TG; ix++) {
  const a = iz * TW + ix, b = a + TW, c = b + 1, d = a + 1;
  tIdx[q++] = a; tIdx[q++] = b; tIdx[q++] = d; tIdx[q++] = b; tIdx[q++] = c; tIdx[q++] = d;
}
// Exact height of the rendered mesh (so grass and trees sit on it, not near it).
function meshH(x, z) {
  const fx = (x + TS / 2) / TC, fz = (z + TS / 2) / TC;
  const ix = Math.min(TG - 1, Math.max(0, Math.floor(fx))), iz = Math.min(TG - 1, Math.max(0, Math.floor(fz)));
  const u = fx - ix, v = fz - iz, a = H[iz * TW + ix], b = H[(iz + 1) * TW + ix], c = H[(iz + 1) * TW + ix + 1], d = H[iz * TW + ix + 1];
  return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
}
const tGeo = new THREE.BufferGeometry();
tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
tGeo.setAttribute('uv', new THREE.BufferAttribute(tUv, 2));
tGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
tGeo.computeVertexNormals();
{
  const nrm = tGeo.attributes.normal.array, col = new THREE.Color();
  const gA = new THREE.Color(0.8, 0.95, 0.7), gB = new THREE.Color(1.3, 1.15, 0.75), white = new THREE.Color(1, 1, 1), tMix = new Float32Array(TW * TW * 2);
  for (let k = 0; k < TW * TW; k++) {
    const x = tPos[k * 3], h = tPos[k * 3 + 1], z = tPos[k * 3 + 2], ny = nrm[k * 3 + 1];
    const rk = smooth(0.86, 0.66, ny), sn = XMAS ? smooth(0.42, 0.72, ny) * 1.25 : smooth(real ? 2500 : 330, real ? 2800 : 430, h) * smooth(0.5, 0.75, ny);      // the valley is a small-scale Alps; real roads get snow only where it lies in summer
    col.copy(gA).lerp(gB, smooth(0.3, 0.7, fbm(x / 45, z / 45, 3))).lerp(white, rk);   // tint the grass, leave rock alone
    if (XMAS) { const d = 0.9 + 0.2 * fbm(x / 30, z / 30, 3); col.setRGB(d, d, d * 1.04); }          // drifts: faint light and shade across the snow
    tCol.set([col.r, col.g, col.b], k * 3); tMix.set([rk, sn], k * 2);
  }
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  tGeo.setAttribute('aMix', new THREE.BufferAttribute(tMix, 2));
  // Relief that reads from far away: gullies darker, crests lighter, and ridges casting long shadows across distant slopes.
  const shade = new Float32Array(TW * TW);
  for (let iz = 0; iz < TW; iz++) for (let ix = 0; ix < TW; ix++) {
    const k = iz * TW + ix, x = tPos[k * 3], h = H[k], z = tPos[k * 3 + 2];
    const around = H[iz * TW + Math.max(ix - 1, 0)] + H[iz * TW + Math.min(ix + 1, TG)] + H[Math.max(iz - 1, 0) * TW + ix] + H[Math.min(iz + 1, TG) * TW + ix];
    const cav = Math.min(1.2, Math.max(0.6, 1 - (around - 4 * h) * 0.06));
    tCol[k * 3] *= cav; tCol[k * 3 + 1] *= cav; tCol[k * 3 + 2] *= cav;
    let lit = 1, far = smooth(450, 650, Math.hypot(x, z));
    if (real) { const nr = nearRoad(x, z); far = smooth(120, 220, nr ? nr.d : 999); }       // on a real course the road goes everywhere: bake wherever the live shadows can't reach
    if (far > 0) for (let t = 20; t < 1400; t += 22) {            // walk toward the sun; does a ridge get in the way?
      const px = x + sunDir.x * t, pz = z + sunDir.z * t;
      if (Math.abs(px) > TS / 2 || Math.abs(pz) > TS / 2) break;
      lit = Math.min(lit, (h + 3 + sunDir.y * t - meshH(px, pz)) / t * 10);
      if (lit <= 0) { lit = 0; break; }
    }
    shade[k] = 1 - far * 0.58 * (1 - lit);
  }
  tGeo.setAttribute('aShade', new THREE.BufferAttribute(shade, 1));
}
const rockMap = imgTex(imgRock, true);
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: imgTex(imgGrass, true), normalMap: imgTex(imgGrassN), roughness: 1 });
terrainMat.onBeforeCompile = s => {      // grass on the flats, rock on the steeps, snow up high; a second, larger sample hides the tiling
  s.uniforms.uRock = { value: rockMap }; s.uniforms.uSunAmt = uSunAmt;
  s.vertexShader = 'attribute vec2 aMix; attribute float aShade; varying vec2 vMix; varying float vShade;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vMix = aMix; vShade = aShade;');
  s.fragmentShader = 'uniform sampler2D uRock; uniform float uSunAmt; varying vec2 vMix; varying float vShade;\n' + s.fragmentShader.replace('#include <map_fragment>', `
    vec3 gc = mix(texture2D(map, vMapUv).rgb, texture2D(map, vMapUv * 0.137).rgb, 0.15);
    gc = mix(gc, vec3(gc.g * 0.6, gc.g * 1.05, gc.g * 0.35), 0.4);                       // lean the bare ground toward the grass colour, so the meadow's edge doesn't show
    vec3 r1 = texture2D(uRock, vMapUv * 0.3).rgb, r2 = texture2D(uRock, vMapUv * 0.041).rgb, r3 = texture2D(uRock, vMapUv * 0.009).rgb;
    float l2 = dot(r2, vec3(0.333)), l3 = dot(r3, vec3(0.333));
    vec3 rc = mix(r1, r2, 0.4) * (0.35 + l2 * 1.2 + l3 * 1.6);                          // light and dark bands across whole rock faces
    float rockAmt = smoothstep(0.3, 0.7, vMix.x + (l2 - 0.3) * 0.9);                     // ragged edges where grass gives way to rock
    float snowAmt = smoothstep(0.35, 0.65, vMix.y + (l3 - 0.3) * 0.8);
    diffuseColor.rgb *= mix(mix(gc, rc, rockAmt), ${XMAS ? 'vec3(0.66, 0.70, 0.78)' : 'vec3(0.92)'}, snowAmt) * mix(1., vShade, uSunAmt);`);
};
const terrain = new THREE.Mesh(tGeo, terrainMat);
terrain.receiveShadow = true; terrain.castShadow = true;
scene.add(terrain);

export { meshH, TS, TC, TG, TW, tPos, tCol, tGeo, H, terrainMat };
