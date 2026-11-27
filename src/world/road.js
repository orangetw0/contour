import { LEN, N, P, R, XMAS, closed, line, real, COUNTRY } from '../course/index.js';
import * as THREE from 'three';
import { canvas2d } from '../util/dom.js';
import { rnd } from '../util/noise.js';
import { imgAsphalt, imgTex, imgAsphaltN, imgGravel, imgGrass, imgRock } from './textures.js';
import { MAX_ANISO, scene } from './renderer.js';
import { uTime, rainU } from './sky.js';
import { meshH } from './terrain.js';
import { LOOK } from './look.js';

/* ---------- road ---------- */
const TILES = Math.round(LEN / 12);
function strip(offA, dyA, offB, dyB, uA, uB, vTiles) {
  const rows = closed ? N + 1 : N;                              // a loop's ribbon joins back onto its start; an open road's does not
  const pos = new Float32Array(rows * 6), uv = new Float32Array(rows * 4), idx = new Uint32Array((rows - 1) * 6);
  for (let i = 0; i < rows; i++) {
    const j = i % N, p = P[j], r = R[j];
    pos.set([p.x + r.x * offA, p.y + dyA, p.z + r.z * offA, p.x + r.x * offB, p.y + dyB, p.z + r.z * offB], i * 6);
    uv.set([uA, i / N * vTiles, uB, i / N * vTiles], i * 4);
    if (i < rows - 1) idx.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}
function asphaltTex() {
  const W = 1024, Hh = 2048, [c, g] = canvas2d(W * 2, Hh * 2);
  g.scale(2, 2);
  for (let x = 0; x < W; x += 439) for (let y = 0; y < Hh; y += 512) g.drawImage(imgAsphalt, x, y, 439, 512);   // 3 m scan tiles
  const style = LOOK.road, [tr, tg, tb, ta] = style.tint;
  g.fillStyle = `rgba(${tr},${tg},${tb},${ta})`; g.fillRect(0, 0, W, Hh);                                           // damp, weathered or bleached
  if (style.setts) {                                   // granite setts in rows across the road, each a little different
    for (let y = 0, row = 0; y < Hh; y += 30, row++) for (let x = (row % 2) * -23; x < W; x += 46) {
      const l = 96 + rnd() * 56 | 0; g.fillStyle = `rgba(${l},${l - 3},${l - 9},0.9)`; g.fillRect(x + 2, y + 2, 42, 26);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 4, y + 3, 38, 6);
    }
    g.fillStyle = 'rgba(30,28,24,0.25)'; g.fillRect(0, 0, W, Hh);
  }
  if (LOOK.frost) { g.fillStyle = 'rgba(205,210,220,0.18)'; g.fillRect(0, 0, W, Hh); }
  if (!style.setts) for (const x of [0.2, 0.36, 0.64, 0.8]) {            // darker wheel tracks
    const gr = g.createLinearGradient((x - 0.06) * W, 0, (x + 0.06) * W, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.17)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect((x - 0.06) * W, 0, 0.12 * W, Hh);
  }
  for (let i = 0; i < 3; i++) {                        // repair patches
    const w = 120 + rnd() * 200, h = 200 + rnd() * 400;
    g.fillStyle = 'rgba(18,18,20,0.13)'; g.fillRect(rnd() * (W - w), rnd() * (Hh - h), w, h);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {                       // cracks
    let x = rnd() * W, y = rnd() * Hh, a = rnd() * 6.28;
    g.strokeStyle = 'rgba(10,10,12,0.75)'; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(x, y);
    for (let k = 0, n = 20 + rnd() * 50; k < n; k++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
    g.stroke();
  }
  const paint = 'rgba(224,220,206,0.92)', lines = [];           // paint: [x, width, dashed]
  if (style.edge !== 'none') lines.push([36, 16, style.edge === 'dashed'], [972, 16, style.edge === 'dashed']);
  if (style.centre === 'dashed') lines.push([505, 14, true]);
  if (style.centre === 'yellow') lines.push([494, 12, false, 'rgba(226,178,52,0.92)'], [518, 12, false, 'rgba(226,178,52,0.92)']);
  for (const [x, w, dashed, colour] of lines) {
    g.fillStyle = colour || paint;
    if (!dashed) g.fillRect(x, 0, w, Hh); else if (x > 400 && x < 600) g.fillRect(x, 0, w, Hh / 3); else for (let y = 0; y < Hh; y += Hh / 8) g.fillRect(x, y, w, Hh / 24);
    for (let i = 0; i < 2000; i++) { const sz = 1 + rnd() * 3; g.fillStyle = 'rgba(72,72,76,0.7)'; g.fillRect(x + rnd() * w, rnd() * Hh, sz, sz * (1 + rnd() * 3)); }      // worn paint
  }
  if (LOOK.snowy) {                                    // snow ploughed to the edges, slush between the wheel tracks
    for (const [x0, x1] of [[0, 150], [W, W - 150]]) {
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(226,232,242,1)'); gr.addColorStop(0.45, 'rgba(214,222,234,0.85)'); gr.addColorStop(1, 'rgba(214,222,234,0)');
      g.fillStyle = gr; g.fillRect(Math.min(x0, x1), 0, 150, Hh);
    }
    for (let i = 0; i < 2600; i++) {
      const edge = rnd() < 0.7, x = edge ? (rnd() < 0.5 ? rnd() * 190 : W - rnd() * 190) : 440 + rnd() * 150, r = 3 + rnd() * (edge ? 16 : 9);
      g.fillStyle = `rgba(222,229,240,${edge ? 0.5 : 0.22})`; g.beginPath(); g.ellipse(x, rnd() * Hh, r, r * (1.5 + rnd() * 2.5), 0, 0, 6.283); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO;
  return t;
}
function wetTex() {   // roughness: mostly damp, with glassy standing water in the ruts and at the edges
  const S = 512, [c, g] = canvas2d(S, S);
  g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const edge = rnd() < 0.7, x = (edge ? (rnd() < 0.5 ? 0.04 + rnd() * 0.2 : 0.76 + rnd() * 0.2) : rnd()) * S;
    const y = 70 + rnd() * (S - 140), r = 8 + rnd() * 20;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(70,70,70,0.9)'); gr.addColorStop(0.4, 'rgba(70,70,70,0.6)'); gr.addColorStop(1, 'rgba(70,70,70,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO;
  t.repeat.set(1, Math.round(TILES / 3) / TILES);
  return t;
}
const asphaltMap = asphaltTex();
const asphaltNormal = imgTex(imgAsphaltN); asphaltNormal.repeat.set(7 / 3, 4);
const road = new THREE.Mesh(strip(-3.5, 0, 3.5, 0, 0, 1, TILES),
  new THREE.MeshStandardMaterial({ map: asphaltMap, roughnessMap: wetTex(), roughness: 1, metalness: 0, normalMap: asphaltNormal, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1 }));
road.receiveShadow = true;
scene.add(road);
road.material.onBeforeCompile = s => {      // rain rings: each small cell of road gets a ripple that spreads and fades
  s.uniforms.uTime = uTime; s.uniforms.uRain = rainU.uRain;
  s.vertexShader = 'varying vec3 vWp;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.)).xyz;');
  s.fragmentShader = `uniform float uTime, uRain; varying vec3 vWp;
    vec2 rip(vec2 p, float t){
      vec2 i = floor(p), f = fract(p) - 0.5;
      float h1 = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), h2 = fract(h1 * 57.31 + 0.37);
      float life = fract(t * (0.7 + h2 * 0.6) + h1 * 7.);
      vec2 d = f - (vec2(h1, h2) - 0.5) * 0.24; float r = length(d) + 1e-4, R = life * 0.36;
      return d / r * sin((r - R) * 60.) * exp(-pow((r - R) * 14., 2.)) * (1. - life);
    }
  ` + s.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    if (uRain > 0.01) {
      vec2 rp = rip(vWp.xz * 3.2, uTime) + rip(vWp.xz * 2.1 + 13.7, uTime * 0.9 + 3.);
      normal = normalize(normal + (viewMatrix * vec4(rp.x, 0., rp.y, 0.)).xyz * 0.5 * uRain * smoothstep(40., 8., length(vViewPosition)));
    }`);
};

function shoulderTex() {
  const [c, g] = canvas2d(512, 512);
  g.drawImage(imgGravel, 0, 0, 512, 512);
  const gr = g.createLinearGradient(0, 0, 512, 0);       // gravel at the road edge, overgrown further out
  gr.addColorStop(0, 'rgba(40,38,28,0.35)'); gr.addColorStop(0.3, 'rgba(46,58,24,0.8)'); gr.addColorStop(1, 'rgba(44,62,22,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  if (LOOK.snowy) {                                    // a snowbank: grey-blue at dusk, brighter by day
    const day = XMAS ? 0 : 28;
    g.fillStyle = XMAS ? '#b4bccb' : '#ced5e0'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1500; i++) { const l = 168 + day + rnd() * 40 | 0; g.fillStyle = `rgba(${l},${l + 5},${l + 16},0.5)`; g.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 10, 2 + rnd() * 6); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO;
  return t;
}
const shoulderMat = new THREE.MeshStandardMaterial({ map: shoulderTex(), roughness: 1 });
for (const g of [strip(-6.8, -0.72, -3.5, 0.005, 1, 0, LEN / 5), strip(3.5, 0.005, 6.8, -0.72, 0, 1, LEN / 5)]) {
  const m = new THREE.Mesh(g, shoulderMat); m.receiveShadow = true; scene.add(m);
}

/* ---------- walls under the road's edges ---------- */
// Where the land drops away right at the verge (the inside of a hairpin above the leg below, a steep embankment),
// a stone retaining wall stands under the verge's edge down into the ground, so the road never hangs in the air.
// Not where another piece of road passes underneath: that is a bridge.
// face: a direction the first triangle should face; the whole mesh is turned over if it does not
const flatGeo = (pos, uv, idx, face) => {
  const [a, b, c] = idx, ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  if ((uy * vz - uz * vy) * face[0] + (uz * vx - ux * vz) * face[1] + (ux * vy - uy * vx) * face[2] < 0) idx = idx.map((v, k) => k % 3 === 1 ? idx[k + 1] : k % 3 === 2 ? idx[k - 1] : v);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const wallMat = new THREE.MeshStandardMaterial({ map: imgTex(imgRock, true), color: LOOK.snowy ? 0xd0d3d8 : 0xc6c2b8, roughness: 1 });
if (real) for (const side of [-1, 1]) {
  const pos = [], uv = [], idx = [], rows = [];
  for (let i = 0; i < N; i += 2) {
    const p = P[i], r = R[i], x0 = p.x + r.x * side * 6.8, z0 = p.z + r.z * side * 6.8, x1 = p.x + r.x * side * 7, z1 = p.z + r.z * side * 7, top = p.y - 0.7;
    const ground = Math.min(meshH(x0, z0), meshH(x1, z1), meshH(p.x + r.x * side * 8, p.z + r.z * side * 8)), foot = Math.min(top - 0.3, ground - 0.6), n = line.nearRoad(x1, z1);
    rows.push(ground < top - 0.15 && !(n && n.d < 6));                 // does the ground fall away under the verge here?
    pos.push(x0, top, z0, x1, foot, z1); uv.push(i * 0.5, 0, i * 0.5, (top - foot) / 3);
  }
  let first = -1;
  for (let k = 0; k + 1 < rows.length; k++) if (rows[k] || rows[k + 1]) { const a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); if (first < 0) first = 2 * k; }
  if (idx.length) { const m = new THREE.Mesh(flatGeo(pos, uv, idx, [R[first].x * side, 0.3, R[first].z * side]), wallMat); m.receiveShadow = true; m.castShadow = true; scene.add(m); }
}

/* ---------- turning places at the ends of an open road ---------- */
/* Each end of an out-and-back road opens into a place to turn: the tarmac carries on round an island and back, on
   the path riders follow (line.turn). How it is built depends on where the road is:
     roundabout  a small continental roundabout: kerbed grass island, white line round it, the blue roundabout sign
     dutch       the same with a red-brown cycle track round the ring
     lane        a country lane's end: a stone-edged island of dry gravel with a boulder on it
     summit      the top of a mountain pass: a bare turning place round a patch of gravel and a cairn
     setts       stone posts round a gravelled island, the road's own setts under the wheels
     culdesac    an American cul-de-sac: concrete kerb, grassed island, double yellow line round it
     mini        a British mini-roundabout: a white painted dome */
const turns = [];
if (line.turn) {
  const { turn } = line, sort = (real.look || {}).road || 'main', EDGE = 4.5, ISLE = turn.radius - 0.8, spot = { x: 0, y: 0, a: 0 };
  const climb = P[N - 1].y - P[0].y, paint = new THREE.MeshStandardMaterial({ color: 0xd9d5c6, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const grassCol = LOOK.snowy ? new THREE.Color(0.86, 0.89, 0.94) : new THREE.Color(0.8 * LOOK.grass[0], 0.98 * LOOK.grass[1], 0.5 * LOOK.grass[2]);
  const mats = {
    grass: new THREE.MeshStandardMaterial({ map: LOOK.snowy ? null : imgTex(imgGrass, true), color: grassCol, roughness: 1 }),
    gravel: new THREE.MeshStandardMaterial({ map: imgTex(imgGravel, true), color: LOOK.snowy ? 0xdfe4ec : 0xd8d0c0, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ map: imgTex(imgRock, true), color: 0xb9b6ae, roughness: 0.95 }),
  };
  if (mats.grass.map) mats.grass.map.repeat.set(10, 2);
  mats.gravel.map.repeat.set(6, 3);
  const kerbCol = { roundabout: 0xa9a69c, dutch: 0xb4b1a8, lane: 0xc2b08a, setts: 0x8f8d88, culdesac: 0xc4c1b6 };
  const lathe = (profile, mat, c, y) => {                          // a shape turned about the island's centre
    const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 56), mat);
    m.position.set(c.x, y, c.z); m.receiveShadow = true; m.castShadow = true; scene.add(m); return m;
  };
  const ring = (r0, r1, mat, c, y) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72).rotateX(-Math.PI / 2), mat); m.position.set(c.x, y, c.z); m.receiveShadow = true; scene.add(m); return m; };
  turn.ends.forEach((end, e) => {
    const kind = COUNTRY === 'US' || sort === 'us' ? 'culdesac' : sort === 'setts' ? 'setts' : sort === 'pass' && Math.abs(climb) > 100 && (climb > 0) === (e === 1) ? 'summit'
      : sort === 'dike' || COUNTRY === 'NL' ? 'dutch' : COUNTRY === 'GB' ? 'mini' : sort === 'lane' ? 'lane' : 'roundabout';
    const y = end.p.y, c = end.c, u2 = turn.stem + turn.ease * turn.phi, M = Math.ceil(turn.half / 0.75);
    const world = (x, w, h, into, at) => { into[at] = end.p.x + end.out.x * x + end.side.x * w; into[at + 1] = y + h; into[at + 2] = end.p.z + end.out.z * x + end.side.z * w; };
    // the tarmac, in two mirrored halves: each a ribbon from the middle (the road's centre line, then the island's edge) out to the outer edge.
    // Across it the road's own picture carries on, so its edge line and wheel tracks run on round the outside of the island.
    const vEnd = e ? (N - 1) / N * TILES : 0, texSide = turn.keep * (e ? 1 : -1);
    for (const half of [1, -1]) {
      const pos = new Float32Array((M + 1) * 6), uv = new Float32Array((M + 1) * 4), sh = new Float32Array((M + 1) * 6), shUv = new Float32Array((M + 1) * 4), idx = [];
      for (let k = 0; k <= M; k++) {
        const u = turn.half * k / M, wide = 3.5 + (EDGE - 3.5) * Math.min(1, u / turn.stem);
        turn.local(u, spot);
        const ox = spot.x - Math.sin(spot.a) * wide, oy = spot.y + Math.cos(spot.a) * wide, round = Math.max(0, (u - u2) / (turn.half - u2)), b = Math.PI * (1 - round);
        const ix = u <= u2 ? (turn.centre - ISLE) * u / u2 : turn.centre + ISLE * Math.cos(b), iy = u <= u2 ? 0 : ISLE * Math.sin(b), lat = u <= u2 ? 0 : -0.5 * Math.min(1, (Math.PI - b) / 0.5);
        world(ix, iy * half, 0.006, pos, k * 6); world(ox, oy * half, 0.006, pos, k * 6 + 3);
        const v = vEnd + (e ? 1 : -1) * u / LEN * TILES;
        uv.set([0.5 + texSide * half * lat / 7, v, 0.5 + texSide * half * wide / 7, v], k * 4);
        // the verge round the outside, falling away like the road's own
        world(ox, oy * half, 0.005, sh, k * 6); world(spot.x - Math.sin(spot.a) * (wide + 3.3), (spot.y + Math.cos(spot.a) * (wide + 3.3)) * half, -0.72, sh, k * 6 + 3);
        shUv.set([0, u / 5, 1, u / 5], k * 4);
        if (k < M) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
      }
      const pad = new THREE.Mesh(flatGeo(pos, uv, idx, [0, 1, 0]), road.material), verge = new THREE.Mesh(flatGeo(sh, shUv, idx, [0, 1, 0]), shoulderMat);
      pad.receiveShadow = true; verge.receiveShadow = true; scene.add(pad, verge);
    }
    // the island and what stands on it
    const kerbed = kerbCol[kind] !== undefined;
    if (kerbed) {
      const top = kind === 'roundabout' || kind === 'dutch' || kind === 'culdesac' ? mats.grass : mats.gravel, dome = top === mats.grass ? 0.45 : 0.12;
      lathe([[ISLE, -0.05], [ISLE - 0.04, 0.13], [ISLE - 0.32, 0.15]], new THREE.MeshStandardMaterial({ color: kerbCol[kind], roughness: 0.9, side: THREE.DoubleSide }), c, y);
      const inner = ISLE - 0.32, profile = []; for (let k = 0; k <= 8; k++) profile.push([Math.max(0.001, inner * k / 8), 0.15 + dome * (1 - (k / 8) ** 2)]);
      const mound = lathe(profile, top.clone(), c, y); mound.material.side = THREE.DoubleSide;
    }
    if (kind === 'roundabout' || kind === 'dutch') ring(ISLE + 0.3, ISLE + 0.42, paint, c, y + 0.012);                                   // a white line round the island
    if (kind === 'culdesac') { const yellow = paint.clone(); yellow.color.set(0xd2a02c); ring(ISLE + 0.3, ISLE + 0.41, yellow, c, y + 0.012); ring(ISLE + 0.52, ISLE + 0.63, yellow, c, y + 0.012); }
    if (kind === 'dutch') ring(turn.radius + 0.25, turn.radius + 2.6, new THREE.MeshStandardMaterial({ color: 0x8c3b2d, roughness: 0.9, normalMap: asphaltNormal, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), c, y + 0.01);      // the cycle track
    if (kind === 'mini') lathe([[0.001, 0.09], [1.2, 0.07], [2.2, 0.012]], new THREE.MeshStandardMaterial({ color: 0xe6e3d8, roughness: 0.8, side: THREE.DoubleSide }), c, y);
    if (kind === 'summit') {                                       // loose gravel where nobody drives, and a cairn of flat stones
      ring(0, ISLE + 0.2, mats.gravel, c, y + 0.014).material = Object.assign(mats.gravel.clone(), { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      for (let k = 0, h = 0; k < 7; k++) {
        const w = 0.62 - k * 0.07, t = 0.2 + rnd() * 0.08, st = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mats.stone);
        st.scale.set(w, t / 2, w * (0.8 + rnd() * 0.3)); st.position.set(c.x + (rnd() - 0.5) * 0.08, y + h + t / 2, c.z + (rnd() - 0.5) * 0.08); st.rotation.y = rnd() * 6.28; st.castShadow = true; scene.add(st); h += t * 0.82;
      }
    }
    if (kind === 'lane') for (const [dx, dz, sc] of [[0.3, -0.2, 0.75], [-0.9, 0.5, 0.4], [0.9, 0.9, 0.3]]) {                           // a boulder or two
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mats.stone); st.scale.set(sc * 1.2, sc * 0.8, sc); st.position.set(c.x + dx, y + 0.2 + sc * 0.5, c.z + dz); st.rotation.set(rnd(), rnd() * 6.28, 0); st.castShadow = true; scene.add(st);
    }
    if (kind === 'setts') for (let k = 0; k < 10; k++) {           // granite posts, as along the old pass road
      const a = k / 10 * 6.283, st = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.95, 7), mats.stone);
      st.position.set(c.x + Math.cos(a) * (ISLE - 0.55), y + 0.6, c.z + Math.sin(a) * (ISLE - 0.55)); st.castShadow = true; scene.add(st);
    }
    if (kind === 'roundabout' || kind === 'dutch' || kind === 'lane' || kind === 'mini') {
      // the blue roundabout sign, facing the road: arrows turning the way traffic goes round
      const [cv, g] = canvas2d(128, 128);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 63, 0, 6.283); g.fill();
      g.fillStyle = '#1f4fa3'; g.beginPath(); g.arc(64, 64, 58, 0, 6.283); g.fill();
      g.translate(64, 64); if (turn.keep < 0) g.scale(-1, 1);
      g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = 11;
      for (let k = 0; k < 3; k++) { g.rotate(6.283 / 3); g.beginPath(); g.arc(0, 0, 32, 0.25, 1.45); g.stroke(); g.beginPath(); g.moveTo(34 * Math.cos(0.25) + 13, 34 * Math.sin(0.25) + 4); g.lineTo(32 * Math.cos(0.25) - 13, 32 * Math.sin(0.25) + 4); g.lineTo(32 * Math.cos(0.02), 32 * Math.sin(0.02) - 14); g.fill(); }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAX_ANISO;
      const sign = new THREE.Group(), face = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      const back = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32).rotateY(Math.PI), new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.7 })), post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 8), back.material);
      face.position.set(0, 2.1, 0.04); back.position.set(0, 2.1, 0.035); post.position.y = 1.15; post.castShadow = face.castShadow = true;
      sign.add(face, back, post); sign.position.set(c.x - end.out.x * (ISLE - 1.2), y + 0.3, c.z - end.out.z * (ISLE - 1.2)); sign.rotation.y = Math.atan2(-end.out.x, -end.out.z); scene.add(sign);
    }
    turns.push({ kind, centre: c, end });
  });
}

// turns: the turning places built above, for anything that wants to stand near one: [{ kind, centre, end }]
export { road, turns };
