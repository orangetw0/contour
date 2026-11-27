import { line, START, COURSE_NAME } from '../course/index.js';
import * as THREE from 'three';
import { canvas2d } from '../util/dom.js';
import { gatesFor } from '../sim/lap.js';
import { MAX_ANISO, scene } from './renderer.js';
import { meshH } from './terrain.js';

/* ---------- start and finish arches ----------
   An event gantry over the road: two banner-wrapped legs on ballast blocks out on the verges, a deep header across
   the top with Contour's name and mark on both faces, hoardings along the road edge either side, and a chequered
   line on the tarmac. A loop gets one (the lap line); an out-and-back gets one near each end.
   Nothing here draws from the scenery's shared random sequence, so the rest of the world stays where it was. */
const SAND = '#ffcf8f', DARK = '#14100c', WHITE = '#ffffff', FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const HALF = 5.3, LEG_W = 0.9, LEG_D = 1.1, CLEAR = 5.2, HEAD_H = 1.7, HEAD_D = 1.25, HEAD_W = HALF * 2 + LEG_W;   // metres

const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t; };

// Contour's mark: a hill as a map draws it, a few nested height lines round a summit
function mark(g, cx, cy, r, colour, width) {
  g.strokeStyle = colour; g.lineWidth = width; g.lineJoin = 'round';
  for (let k = 0; k < 4; k++) {
    const rk = r * (1 - k * 0.235), ox = cx + k * r * 0.07, oy = cy - k * r * 0.045;
    g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = i / 72 * Math.PI * 2, rr = rk * (1 + 0.14 * Math.sin(a * 2 + 0.6 + k * 0.25) + 0.08 * Math.sin(a * 3 + 1.9));
      g[i ? 'lineTo' : 'moveTo'](ox + Math.cos(a) * rr * 1.12, oy + Math.sin(a) * rr * 0.9);
    }
    g.closePath(); g.stroke();
  }
  g.fillStyle = colour; g.beginPath(); g.arc(cx + r * 0.3, cy - r * 0.19, width * 0.9, 0, Math.PI * 2); g.fill();
}
// a word with its letters spaced out, starting at x; returns where it ended
function spaced(g, text, x, y, gap) { for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + gap; } return x - gap; }
const spacedWidth = (g, text, gap) => [...text].reduce((w, ch) => w + g.measureText(ch).width + gap, -gap);
// faint height lines wandering across a banner
function heightLines(g, w, h, step, alpha) {
  g.strokeStyle = `rgba(255,207,143,${alpha})`; g.lineWidth = 3;
  for (let y = -step; y < h + step; y += step) {
    g.beginPath();
    for (let x = 0; x <= w; x += 8) g[x ? 'lineTo' : 'moveTo'](x, y + Math.sin(x / w * 6.283 + y * 0.011) * step * 0.55 + Math.sin(x / w * 12.566 + y * 0.023) * step * 0.2);
    g.stroke();
  }
}

// the header's face: mark, CONTOUR, and a sand panel saying what this arch is
function headerTex(wording) {
  const W = 2048, H = Math.round(W * HEAD_H / HEAD_W), [c, g] = canvas2d(W, H);
  g.fillStyle = DARK; g.fillRect(0, 0, W, H);
  heightLines(g, W, H, 46, 0.1);
  const split = W * 0.62, lean = H * 0.32;                       // the sand panel starts here, with a raked edge
  g.fillStyle = SAND; g.beginPath(); g.moveTo(split + lean, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(split, H); g.closePath(); g.fill();
  g.fillStyle = SAND; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
  mark(g, 150, H / 2, H * 0.31, SAND, 9);
  g.textBaseline = 'middle'; g.fillStyle = WHITE; g.font = `700 ${Math.round(H * 0.5)}px ${FONT}`;
  const gap = 22, word = 'CONTOUR', room = split - 300 - 40, k = Math.min(1, room / spacedWidth(g, word, gap));
  g.save(); g.translate(300, H / 2 + 6); g.scale(k, 1); spaced(g, word, 0, 0, gap); g.restore();
  // the panel: the route's name small above the wording
  const px = split + lean + 30, pw = W - px - 40, fit = (text, size, weight, y, sp) => {
    g.font = `${weight} ${size}px ${FONT}`;
    const s = Math.min(1, pw / spacedWidth(g, text, sp));
    g.save(); g.translate(px + (pw - spacedWidth(g, text, sp) * s) / 2, y); g.scale(s, 1); spaced(g, text, 0, 0, sp); g.restore();
  };
  g.fillStyle = DARK;
  fit(COURSE_NAME.toUpperCase(), Math.round(H * 0.17), 600, H * 0.25, 8);
  fit(wording, Math.round(H * 0.4), 800, H * 0.62, 10);
  return tex(c);
}
// a leg's banner: height lines, the name reading up the leg, sand bands top and bottom
function legTex() {
  const W = 256, H = 1536, [c, g] = canvas2d(W, H);
  g.fillStyle = DARK; g.fillRect(0, 0, W, H);
  heightLines(g, W, H, 58, 0.22);
  g.fillStyle = SAND; g.fillRect(0, H - 150, W, 150); g.fillRect(0, 0, W, 26);
  mark(g, W / 2, H - 290, 74, SAND, 7);
  g.save(); g.translate(W / 2 + 8, H - 440); g.rotate(-Math.PI / 2);
  g.fillStyle = WHITE; g.textBaseline = 'middle'; g.font = `700 150px ${FONT}`; spaced(g, 'CONTOUR', 0, 0, 16);
  g.restore();
  return tex(c);
}
// the hoarding along the road edge: the name and mark, over and over
function hoardingTex() {
  const W = 1024, H = 170, [c, g] = canvas2d(W, H);
  g.fillStyle = DARK; g.fillRect(0, 0, W, H);
  g.fillStyle = SAND; g.fillRect(0, 0, W, 12); g.fillRect(W / 2, 12, W / 2, H - 12);
  mark(g, 70, H / 2 + 6, 44, SAND, 5); mark(g, W / 2 + 70, H / 2 + 6, 44, DARK, 5);
  g.textBaseline = 'middle'; g.font = `700 84px ${FONT}`;
  g.fillStyle = WHITE; spaced(g, 'CONTOUR', 140, H / 2 + 10, 6); g.fillStyle = DARK; spaced(g, 'CONTOUR', W / 2 + 140, H / 2 + 10, 6);
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
}
// the line on the road: three rows of half-metre squares, a little worn
function chequerTex() {
  const [c, g] = canvas2d(448, 96);
  for (let i = 0; i < 14; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#d9d5c8' : '#17171a'; g.fillRect(i * 32, j * 32, 32, 32); }
  for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(70,70,74,0.45)'; g.fillRect(Math.random() * 448, Math.random() * 96, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  return tex(c);
}

const plain = new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 0.85 });
const steel = new THREE.MeshStandardMaterial({ color: 0x8a8b8d, roughness: 0.45, metalness: 0.7 });
const concrete = new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 1 });
const banner = map => new THREE.MeshStandardMaterial({ map, roughness: 0.78 });
// a box whose two faces looking up and down the road carry a banner; the other four are plain
const faced = (w, h, d, face) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [plain, plain, plain, plain, face, face]);
const legFace = banner(legTex()), hoardFace = banner(hoardingTex()), chequer = new THREE.MeshStandardMaterial({ map: chequerTex(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const pose = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3() };

function buildArch(s, wording) {
  line.at(s, pose);
  const { p, t } = pose, flat = Math.hypot(t.x, t.z), arch = new THREE.Group();
  arch.position.copy(p); arch.rotation.y = Math.atan2(t.x, t.z);            // the arch's own z runs up the road, x across it
  arch.updateMatrixWorld();
  const shade = m => { m.castShadow = true; m.receiveShadow = true; arch.add(m); return m; };
  const spot = new THREE.Vector3(), top = CLEAR + HEAD_H;

  for (const side of [-1, 1]) {
    // each leg runs from below the ground to the top of the header, so it stands on whatever is there
    spot.set(side * HALF, 0, 0).applyMatrix4(arch.matrixWorld);
    const ground = meshH(spot.x, spot.z) - p.y, verge = Math.max(ground, -0.42), foot = Math.min(ground, -0.42) - 0.6;
    const leg = shade(faced(LEG_W, CLEAR - foot, LEG_D, legFace));
    leg.position.set(side * HALF, (CLEAR + foot) / 2, 0);
    // ballast block the leg is bolted to, and a steel collar round its base
    const block = shade(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 2.1), concrete));
    block.position.set(side * (HALF + 0.15), verge - 0.3, 0);
    const collar = shade(new THREE.Mesh(new THREE.BoxGeometry(LEG_W + 0.16, 0.22, LEG_D + 0.16), steel));
    collar.position.set(side * HALF, verge + 0.56, 0);
    // a brace from leg to header at each top corner
    const brace = shade(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.16), steel));
    brace.position.set(side * (HALF - LEG_W / 2 - 0.5), CLEAR - 0.5, 0); brace.rotation.z = side * Math.PI / 4;
  }
  // the header, with a steel rail along its top and bottom edges
  const head = shade(faced(HEAD_W, HEAD_H, HEAD_D, banner(headerTex(wording))));
  head.position.set(0, CLEAR + HEAD_H / 2, 0);
  for (const y of [CLEAR - 0.04, top + 0.04]) { const rail = shade(new THREE.Mesh(new THREE.BoxGeometry(HEAD_W + 0.1, 0.08, HEAD_D + 0.1), steel)); rail.position.set(0, y, 0); }

  // things that lie along the road tilt with its gradient: the hoardings and the painted line
  const along = new THREE.Group(); along.rotation.x = -Math.atan2(t.y, flat); arch.add(along);
  const LONG = 7, face = hoardFace.clone(); face.map = hoardFace.map.clone(); face.map.repeat.set(LONG / 6, 1); face.map.needsUpdate = true;
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    // the boards face the riders; the same box as a leg, turned to run along the road
    const board = faced(LONG, 1.05, 0.07, face);
    board.rotation.y = Math.PI / 2; board.position.set(side * 4.55, 0.2, end * (LEG_D / 2 + 0.15 + LONG / 2));
    board.castShadow = board.receiveShadow = true; along.add(board);
    for (const k of [-1, 0, 1]) {                                            // feet
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.08), steel);
      post.position.set(side * 4.72, -0.15, board.position.z + k * (LONG / 2 - 0.3)); post.castShadow = true; along.add(post);
    }
  }
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), chequer);
  paint.rotation.x = -Math.PI / 2; paint.position.y = 0.02; paint.receiveShadow = true; along.add(paint);
  scene.add(arch);
  return arch;
}

const gates = gatesFor(line, START);
export const arches = line.closed ? [buildArch(gates.lap, 'START · FINISH')] : [buildArch(gates.home, 'START · FINISH'), buildArch(gates.far, 'FINISH')];
