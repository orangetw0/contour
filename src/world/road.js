import { LEN, N, P, R, XMAS, closed } from '../course/index.js';
import * as THREE from 'three';
import { canvas2d } from '../util/dom.js';
import { rnd } from '../util/noise.js';
import { imgAsphalt, imgTex, imgAsphaltN, imgGravel } from './textures.js';
import { MAX_ANISO, scene } from './renderer.js';
import { uTime, rainU } from './sky.js';
import './terrain.js';

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
  g.fillStyle = 'rgba(8,8,12,0.22)'; g.fillRect(0, 0, W, Hh);                                                     // damp
  for (const x of [0.2, 0.36, 0.64, 0.8]) {            // darker wheel tracks
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
  g.fillStyle = 'rgba(224,220,206,0.92)';              // paint
  g.fillRect(36, 0, 16, Hh); g.fillRect(972, 0, 16, Hh); g.fillRect(505, 0, 14, Hh / 3);
  for (let i = 0; i < 6000; i++) {                     // worn paint
    const s = 1 + rnd() * 3;
    g.fillStyle = 'rgba(72,72,76,0.7)'; g.fillRect([36, 972, 505][i % 3] + rnd() * 16, rnd() * Hh, s, s * (1 + rnd() * 3));
  }
  if (XMAS) {                                          // snow ploughed to the edges, slush between the wheel tracks
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
  if (XMAS) {                                          // a snowbank
    g.fillStyle = '#b4bccb'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1500; i++) { const l = 168 + rnd() * 40 | 0; g.fillStyle = `rgba(${l},${l + 5},${l + 16},0.5)`; g.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 10, 2 + rnd() * 6); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO;
  return t;
}
const shoulderMat = new THREE.MeshStandardMaterial({ map: shoulderTex(), roughness: 1 });
for (const g of [strip(-6.8, -0.72, -3.5, 0.005, 1, 0, LEN / 5), strip(3.5, 0.005, 6.8, -0.72, 0, 1, LEN / 5)]) {
  const m = new THREE.Mesh(g, shoulderMat); m.receiveShadow = true; scene.add(m);
}

export { road };
