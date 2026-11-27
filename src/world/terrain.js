import { real, demH, nearRoad, XMAS, N, P, R, T, line } from '../course/index.js';
import { fbm, smooth, ridged } from '../util/noise.js';
import * as THREE from 'three';
import { sunFlat, sunDir, uSunAmt } from './sky.js';
import { imgTex, imgRock, imgGrass, imgGrassN } from './textures.js';
import { scene } from './renderer.js';
import { LOOK } from './look.js';

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
/* On a real course the land beside the road is shaped the way a road is built into a hill: a level bench under the
   tarmac and its verges, a bank rising from the bench on the uphill side, an embankment falling away on the downhill
   side, and between the two legs of a hairpin one sloping bank joining the upper road to the lower. Every piece of
   road nearby (and the turning loops at the ends of an open road) has a say: none lets the ground stand higher than
   its own bank would, none lets it lie lower than its own embankment. shaped(x, z) is that ground; shaped.d is how
   far away the nearest road is. */
const BIN = 16, REACH = 32, bw = real ? Math.ceil(TS / BIN) : 0, binHead = new Int32Array(bw * bw).fill(-1);
const loopPts = real && line.turn ? line.turn.ends.flatMap(e => e.pts) : [], QN = real ? N + loopPts.length : 0;
const qx = new Float32Array(QN), qy = new Float32Array(QN), qz = new Float32Array(QN), qtx = new Float32Array(QN), qty = new Float32Array(QN), qtz = new Float32Array(QN), binNext = new Int32Array(QN);
for (let k = 0; k < QN; k++) {                    // road points sorted into 16 m squares, so the ones near a place are quick to find
  const p = k < N ? P[k] : loopPts[k - N], bx = Math.floor((p.x + TS / 2) / BIN), bz = Math.floor((p.z + TS / 2) / BIN);
  qx[k] = p.x; qy[k] = p.y; qz[k] = p.z;
  if (k < N) { qtx[k] = T[k].x; qty[k] = T[k].y; qtz[k] = T[k].z; }
  if (bx < 0 || bz < 0 || bx >= bw || bz >= bw) continue;
  binNext[k] = binHead[bz * bw + bx]; binHead[bz * bw + bx] = k;
}
let bench = 8;                                    // metres from the road's centre line to the foot of a bank: the tarmac, the verge and a little more
// (a turning loop's tarmac is wider than the road's, so its bench and verge are 2.5 m wider too)
const VERGE = 6.8;                                // where the verge ends and an embankment may begin to fall away
function shaped(x, z) {
  const base = demH(x, z), bx = Math.floor((x + TS / 2) / BIN), bz = Math.floor((z + TS / 2) / BIN);
  let hi = Infinity, steep = Infinity, lo = -Infinity, dn = 1e9;
  for (let j = Math.max(0, bz - 2); j <= bz + 2 && j < bw; j++) for (let i = Math.max(0, bx - 2); i <= bx + 2 && i < bw; i++) for (let k = binHead[j * bw + i]; k >= 0; k = binNext[k]) {
    const ex = x - qx[k], ez = z - qz[k], d2 = ex * ex + ez * ez;
    if (d2 > REACH * REACH) continue;
    // this piece of road's own level here (it carries on at its own gradient), then its bank above and its embankment below;
    // both steepen away from the road, like a cutting easing out at its foot
    const d = Math.sqrt(d2), y = qy[k] + qty[k] * Math.max(-12, Math.min(12, ex * qtx[k] + ez * qtz[k])) - 0.6, wide = k < N ? 0 : 2.5;
    const e = Math.max(0, d - bench - wide), g = Math.max(0, d - VERGE - wide);
    hi = Math.min(hi, y + e * (0.7 + 0.035 * e)); steep = Math.min(steep, y + e * (1.2 + 0.08 * e)); lo = Math.max(lo, y - g * (0.67 + 0.03 * g));
    if (d < dn) dn = d;
  }
  shaped.d = dn;
  if (dn > 1e8) return base;
  // two legs too close for both rules (a hairpin's upper road right above its lower): the bank climbs from the lower road as steeply as rock
  // will stand, and where even that does not reach the upper road it carries on beneath it; road.js builds the retaining wall that holds the road up
  if (lo > hi) return Math.min(lo, steep);
  return Math.min(hi, Math.max(lo, base - 0.6 * (1 - smooth(bench, bench + 10, dn))));
}
const coarseH = (ix, iz, u, v) => {               // the coarse grid's own surface inside one of its cells
  const a = H[iz * TW + ix], b = H[(iz + 1) * TW + ix], c = H[(iz + 1) * TW + ix + 1], d = H[iz * TW + ix + 1];
  return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
};
const fill = () => {
  for (let iz = 0; iz < TW; iz++) for (let ix = 0; ix < TW; ix++) {
    const x = -TS / 2 + ix * TC, z = -TS / 2 + iz * TC, k = iz * TW + ix, h = real ? shaped(x, z) : terrainH(x, z);
    H[k] = h; tPos.set([x, h, z], k * 3); tUv.set([x / 4, z / 4], k * 2);
  }
};
fill();
/* The grid's cells (10 to 35 m) are much coarser than a 7 m road, so where the ground beside the road has any shape
   to it, the cells there are drawn finer instead: each split into K by K small cells that follow shaped() closely
   by the road and ease back onto the coarse grid's surface by FAR metres out, so the two meet without a step.
   slot: for each coarse cell, which fine patch it has (-1: none). fineH: the fine heights, patch after patch.
   Cells the coarse grid already fits (flat country) stay coarse. */
const NEAR = 18, FAR = 26, TRIS = 300000;
let K = 1, KW = 2, slot = null, fineH = new Float32Array(0), fineMix = fineH, fineCount = 0;
// road samples across the tarmac and verge: under each of these the ground has to be below the road
const roadSpots = fn => {
  for (let i = 0; i < N; i++) for (let o = -5.5; o <= 5.5; o += 1.375) fn(P[i].x + R[i].x * o, P[i].z + R[i].z * o, P[i].y - 0.5);
  for (const p of loopPts) for (const [u, v] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) fn(p.x + u, p.z + v, p.y - 0.5);
};
if (real) {
  // which cells have road close by
  const cand = new Uint8Array(TG * TG), cell = v => Math.min(TG - 1, Math.max(0, Math.floor((v + TS / 2) / TC)));
  for (let k = 0; k < QN; k += k < N ? 2 : 1) for (let iz = cell(qz[k] - FAR); iz <= cell(qz[k] + FAR); iz++) for (let ix = cell(qx[k] - FAR); ix <= cell(qx[k] + FAR); ix++) cand[iz * TG + ix] = 1;
  // of those, the ones whose ground the coarse grid gets wrong by more than a hand's breadth somewhere
  slot = new Int32Array(TG * TG).fill(-1);
  for (let c = 0; c < TG * TG; c++) {
    if (!cand[c]) continue;
    const ix = c % TG, iz = (c - ix) / TG;
    let off = 0;
    for (let j = 0; j < 5 && off <= 0.25; j++) for (let i = 0; i < 5; i++) {
      const u = (i + 0.5) / 5, v = (j + 0.5) / 5, h = shaped(-TS / 2 + (ix + u) * TC, -TS / 2 + (iz + v) * TC);
      off = Math.max(off, Math.abs(h - coarseH(ix, iz, u, v)) * (1 - smooth(NEAR, FAR, shaped.d)));
    }
    if (off > 0.25) slot[c] = fineCount++;
  }
  if (fineCount) {
    // as fine as 2 m where the triangle budget allows; the bench is as wide as the tarmac plus one fine cell's diagonal, so no fine triangle can lean over the road
    K = Math.max(2, Math.min(Math.round(TC / 2), Math.floor(Math.sqrt(TRIS / 2 / fineCount)))); KW = K + 1;
    bench = Math.min(8.5, 3.5 + 1.42 * TC / K + 0.4);              // (on the longest routes the fine cells are too big for that; the check further down catches what leans over)
    fill();
  }
  // where the coarse grid stays it lies about 0.6 m under the road, give or take; where a piece of it still comes within 0.3 m of the
  // tarmac, press its corners down to half a metre below
  roadSpots((x, z, top) => {
    const fx = (x + TS / 2) / TC, fz = (z + TS / 2) / TC, ix = Math.floor(fx), iz = Math.floor(fz);
    if (ix < 0 || iz < 0 || ix >= TG || iz >= TG || slot[iz * TG + ix] >= 0 || coarseH(ix, iz, fx - ix, fz - iz) <= top + 0.2) return;
    const upper = (fx - ix) + (fz - iz) <= 1;
    for (const k of upper ? [iz * TW + ix, (iz + 1) * TW + ix, iz * TW + ix + 1] : [(iz + 1) * TW + ix + 1, (iz + 1) * TW + ix, iz * TW + ix + 1]) if (H[k] > top) { H[k] = top; tPos[k * 3 + 1] = top; }
  });
  // the fine heights. A point on the edge of a patch belongs to every cell that shares it, and all of them must agree:
  // next to a cell left coarse it takes the coarse surface exactly; otherwise it is worked out from where it is alone.
  const fc = TC / K, isFine = (ix, iz) => ix >= 0 && iz >= 0 && ix < TG && iz < TG && slot[iz * TG + ix] >= 0, at = { h: 0, mix: 0 };
  const fineAt = (gi, gj) => {
    const ix = Math.min(TG - 1, Math.floor(gi / K)), iz = Math.min(TG - 1, Math.floor(gj / K)), u = gi / K - ix, v = gj / K - iz, flat = coarseH(ix, iz, u, v);
    const i0 = gi % K ? ix : gi / K - 1, i1 = gi % K ? ix : gi / K, j0 = gj % K ? iz : gj / K - 1, j1 = gj % K ? iz : gj / K;
    let edge = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (i >= 0 && j >= 0 && i < TG && j < TG && !isFine(i, j)) edge = true;
    at.h = flat; at.mix = 1;
    if (edge) return at;
    const h = shaped(gi * fc - TS / 2, gj * fc - TS / 2);
    at.mix = smooth(NEAR, FAR, shaped.d); at.h = h + (flat - h) * at.mix;
    return at;
  };
  fineH = new Float32Array(fineCount * KW * KW); fineMix = new Float32Array(fineCount * KW * KW);
  for (let c = 0; c < TG * TG; c++) {
    if (slot[c] < 0) continue;
    const ix = c % TG, iz = (c - ix) / TG;
    for (let j = 0; j <= K; j++) for (let i = 0; i <= K; i++) { const o = slot[c] * KW * KW + j * KW + i; fineAt(ix * K + i, iz * K + j); fineH[o] = at.h; fineMix[o] = at.mix; }
  }
  // a last check under the road itself: lower any fine corner still standing above it, in every patch that shares the corner
  const lower = (gi, gj, top) => {
    for (let iz = Math.floor((gj - 1) / K); iz <= Math.floor(gj / K); iz++) for (let ix = Math.floor((gi - 1) / K); ix <= Math.floor(gi / K); ix++) {
      if (!isFine(ix, iz)) continue;
      const i = gi - ix * K, j = gj - iz * K, o = slot[iz * TG + ix] * KW * KW + j * KW + i;
      if (i >= 0 && j >= 0 && i <= K && j <= K && fineH[o] > top) fineH[o] = top;
    }
  };
  if (fineCount) roadSpots((x, z, top) => {
    const fx = (x + TS / 2) / fc, fz = (z + TS / 2) / fc, gi = Math.floor(fx), gj = Math.floor(fz);
    if (!isFine(Math.floor(gi / K), Math.floor(gj / K))) return;
    if ((fx - gi) + (fz - gj) <= 1) { lower(gi, gj, top); lower(gi, gj + 1, top); lower(gi + 1, gj, top); }
    else { lower(gi + 1, gj + 1, top); lower(gi, gj + 1, top); lower(gi + 1, gj, top); }
  });
}
// the whole grid, for working out the lie of the land at each corner; where a cell has a fine patch, the patch is drawn in its place
const tIdx = new Uint32Array(TG * TG * 6), tDrawn = new Uint32Array((TG * TG - fineCount) * 6);
for (let iz = 0, q = 0, n = 0; iz < TG; iz++) for (let ix = 0; ix < TG; ix++) {
  const a = iz * TW + ix, b = a + TW, c = b + 1, d = a + 1;
  if (!slot || slot[iz * TG + ix] < 0) { tDrawn[n++] = a; tDrawn[n++] = b; tDrawn[n++] = d; tDrawn[n++] = b; tDrawn[n++] = c; tDrawn[n++] = d; }
  tIdx[q++] = a; tIdx[q++] = b; tIdx[q++] = d; tIdx[q++] = b; tIdx[q++] = c; tIdx[q++] = d;
}
// Exact height of the rendered mesh (so grass and trees sit on it, not near it).
function meshH(x, z) {
  const fx = (x + TS / 2) / TC, fz = (z + TS / 2) / TC;
  const ix = Math.min(TG - 1, Math.max(0, Math.floor(fx))), iz = Math.min(TG - 1, Math.max(0, Math.floor(fz)));
  const u = fx - ix, v = fz - iz, s = slot ? slot[iz * TG + ix] : -1;
  if (s < 0) return coarseH(ix, iz, u, v);
  const i = Math.min(K - 1, Math.max(0, Math.floor(u * K))), j = Math.min(K - 1, Math.max(0, Math.floor(v * K))), p = u * K - i, q = v * K - j, o = s * KW * KW + j * KW + i;
  const a = fineH[o], b = fineH[o + KW], c = fineH[o + KW + 1], d = fineH[o + 1];
  return p + q <= 1 ? a + (d - a) * p + (b - a) * q : c + (b - c) * (1 - p) + (d - c) * (1 - q);
}
// which grid corners touch a fine patch: grass that reads its height from the coarse grid alone (the meadow) should keep off these
const tFine = new Uint8Array(TW * TW);
if (slot) for (let c = 0; c < TG * TG; c++) if (slot[c] >= 0) { const ix = c % TG, k = (c - ix) / TG * TW + ix; tFine[k] = tFine[k + 1] = tFine[k + TW] = tFine[k + TW + 1] = 1; }
const tGeo = new THREE.BufferGeometry();
tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
tGeo.setAttribute('uv', new THREE.BufferAttribute(tUv, 2));
tGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
tGeo.computeVertexNormals();
{
  const nrm = tGeo.attributes.normal.array, col = new THREE.Color();
  const [lr, lg, lb] = real ? LOOK.grass : [1, 1, 1], gA = new THREE.Color(0.8 * lr, 0.95 * lg, 0.7 * lb), gB = new THREE.Color(1.3 * lr, 1.15 * lg, 0.75 * lb), white = new THREE.Color(1, 1, 1), drift = new THREE.Color(), tMix = new Float32Array(TW * TW * 2);
  const wintry = LOOK.snowy || LOOK.season === 'winter';            // winter snow, down to the snow line
  for (let k = 0; k < TW * TW; k++) {
    const x = tPos[k * 3], h = tPos[k * 3 + 1], z = tPos[k * 3 + 2], ny = nrm[k * 3 + 1];
    // snow lies above the snow line, thickening over 300 m of height (the valley is a small-scale Alps, so its line is low and sharp);
    // lying snow covers gentle ground and leaves the steep rock bare, old summer snow only holds on the flatter ground
    const cover = wintry ? smooth(LOOK.snow, LOOK.snow + 300, h + (fbm(x / 160 + 3, z / 160, 3) - 0.5) * 240) : smooth(real ? LOOK.snow : 330, real ? LOOK.snow + 300 : 430, h);
    const rk = smooth(0.86, 0.66, ny), sn = cover * (wintry ? smooth(0.42, 0.72, ny) * 1.25 : smooth(0.5, 0.75, ny));
    col.copy(gA).lerp(gB, smooth(0.3, 0.7, fbm(x / 45, z / 45, 3))).lerp(white, rk);   // tint the grass, leave rock alone
    if (wintry) { const d = 0.9 + 0.2 * fbm(x / 30, z / 30, 3); col.lerp(drift.setRGB(d, d, d * 1.04), cover); }          // drifts: faint light and shade across the snow
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
    diffuseColor.rgb *= mix(mix(gc, rc, rockAmt), ${XMAS ? 'vec3(0.66, 0.70, 0.78)' : LOOK.season === 'winter' ? 'vec3(0.84, 0.87, 0.93)' : 'vec3(0.92)'}, snowAmt) * mix(1., vShade, uSunAmt);`);
};
const terrain = new THREE.Mesh(tGeo, terrainMat);
terrain.receiveShadow = true; terrain.castShadow = true;
scene.add(terrain);
/* The fine patches by the road, as one mesh of their own with the same material. Each fine corner takes whatever the
   coarse grid's corners carry for the look of the ground (colour, rock and snow, baked shade: every attribute it has)
   from the coarse cell it lies in, so the two are always coloured alike. Only how rocky it is comes from its own
   steepness, so a cut bank shows as rock. */
let fineGeo = null;
if (fineCount) {
  tGeo.setIndex(new THREE.BufferAttribute(tDrawn, 1));            // the coarse cells under the patches are no longer drawn
  const n = fineCount * KW * KW, fc = TC / K, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nrm = new Float32Array(n * 3), idx = new Uint32Array(fineCount * K * K * 6);
  const names = Object.keys(tGeo.attributes).filter(a => !['position', 'uv', 'normal'].includes(a)), from = names.map(a => tGeo.attributes[a]), to = from.map(a => new Float32Array(n * a.itemSize));
  const coarseN = tGeo.attributes.normal.array, mixAt = names.indexOf('aMix'), colAt = names.indexOf('color');
  // a coarse attribute at a place inside a cell, blended the way the coarse triangle there would blend it
  const blend = (arr, size, e, ix, iz, u, v) => {
    const a = (iz * TW + ix) * size + e, b = a + TW * size, c = b + size, d = a + size;
    return u + v <= 1 ? arr[a] + (arr[d] - arr[a]) * u + (arr[b] - arr[a]) * v : arr[c] + (arr[b] - arr[c]) * (1 - u) + (arr[d] - arr[c]) * (1 - v);
  };
  for (let c = 0, q = 0; c < TG * TG; c++) {
    if (slot[c] < 0) continue;
    const ix = c % TG, iz = (c - ix) / TG, first = slot[c] * KW * KW;
    for (let j = 0; j <= K; j++) for (let i = 0; i <= K; i++) {
      const o = first + j * KW + i, x = (ix * K + i) * fc - TS / 2, z = (iz * K + j) * fc - TS / 2, u = i / K, v = j / K, m = fineMix[o];
      pos.set([x, fineH[o], z], o * 3); uv.set([x / 4, z / 4], o * 2);
      // which way the drawn ground faces here; toward the edge of the patches it turns into the coarse grid's own, so no seam shows
      let nx = meshH(x - fc, z) - meshH(x + fc, z), ny = 2 * fc, nz = meshH(x, z - fc) - meshH(x, z + fc), l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const steep = ny;
      nx += (blend(coarseN, 3, 0, ix, iz, u, v) - nx) * m; ny += (blend(coarseN, 3, 1, ix, iz, u, v) - ny) * m; nz += (blend(coarseN, 3, 2, ix, iz, u, v) - nz) * m; l = Math.hypot(nx, ny, nz) || 1;
      nrm.set([nx / l, ny / l, nz / l], o * 3);
      from.forEach((a, k) => { for (let e = 0; e < a.itemSize; e++) to[k][o * a.itemSize + e] = blend(a.array, a.itemSize, e, ix, iz, u, v); });
      if (mixAt >= 0) {                              // rock where the fine ground itself is steep; rock is left untinted
        const was = to[mixAt][o * 2], rock = was + (smooth(0.86, 0.66, steep) - was) * (1 - m);
        if (rock > was && colAt >= 0) for (let e = 0; e < 3; e++) to[colAt][o * 3 + e] += (1 - to[colAt][o * 3 + e]) * (rock - was) / (1 - was + 1e-6);
        to[mixAt][o * 2] = rock;
      }
    }
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++, q += 6) { const a = first + j * KW + i, b = a + KW; idx.set([a, b, a + 1, b, b + 1, a + 1], q); }
  }
  fineGeo = new THREE.BufferGeometry();
  fineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  fineGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  fineGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  names.forEach((a, k) => fineGeo.setAttribute(a, new THREE.BufferAttribute(to[k], from[k].itemSize)));
  fineGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  const fine = new THREE.Mesh(fineGeo, terrainMat);
  fine.receiveShadow = true; fine.castShadow = true;
  scene.add(fine);
}

export { meshH, TS, TC, TG, TW, tPos, tCol, tGeo, H, terrainMat, tFine, fineGeo };
