import { canvas2d } from '../util/dom.js';
import { rnd, fbm } from '../util/noise.js';
import { XMAS, real, nearRoad } from '../course/index.js';
import * as THREE from 'three';
import { V3, st0 } from './shared.js';
import { uTime } from './sky.js';
import { meshH, TS } from './terrain.js';
import { chalets, xl, XL_COLS } from './chalets.js';
import { scene } from './renderer.js';
import { LOOK } from './look.js';

/* ---------- trees: pines (a trunk plus whorls of needle cards) and, on real roads, broadleaves (a rounded crown of
   leaf cards, or bare limbs in winter). On real roads the foliage is painted pale and each tree brings its own
   colour, so a wood can be fresh green, deep green or a mix of gold and red. ---------- */
{
  const snowy = LOOK.snowy, plain = real && !snowy, PALE = 3;       // PALE: how much brighter a tree's own colour must be to show at full strength on pale foliage
  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const [bc, bg] = canvas2d(256, 256);
  bg.lineCap = 'round';
  bg.strokeStyle = '#2a1d12'; bg.lineWidth = 5; bg.beginPath(); bg.moveTo(0, 128); bg.lineTo(240, 128); bg.stroke();
  for (let x = 4; x < 250; x += 2.2) {
    const reach = Math.pow(1 - x / 262, 0.55) * 112 * (0.55 + rnd() * 0.45);
    for (const sgn of [-1, 1]) {
      const l = 18 + rnd() * 30 | 0, v = 105 + rnd() * 95 | 0;
      bg.strokeStyle = plain ? `rgb(${v * 0.94 | 0},${v},${v * 0.86 | 0})` : `rgb(${l * 0.75 | 0},${l + 22},${l * 0.5 | 0})`; bg.lineWidth = 1.6 + rnd() * 2.2;
      bg.beginPath(); bg.moveTo(x, 128);
      bg.quadraticCurveTo(x + reach * 0.25, 128 + sgn * reach * 0.6, x + reach * 0.5 + rnd() * 8, 128 + sgn * reach); bg.stroke();
    }
  }
  if (snowy) {                                         // snow lying along each bough, heavier on the upper side, green showing at the tips
    const edge = (x, k) => Math.pow(1 - x / 262, 0.55) * 112 * k;
    for (const [k, al] of [[0.62, 0.5], [0.46, 0.6], [0.3, 0.8]]) {
      bg.fillStyle = `rgba(232,238,250,${al})`; bg.beginPath(); bg.moveTo(0, 128);
      for (let x = 0; x <= 250; x += 5) bg.lineTo(x, 128 - edge(x, k) * (0.85 + rnd() * 0.3));
      for (let x = 250; x >= 0; x -= 5) bg.lineTo(x, 128 + edge(x, k * 0.6) * (0.8 + rnd() * 0.4));
      bg.fill();
    }
    for (let i = 0; i < 260; i++) { const x = rnd() * 246; bg.fillStyle = 'rgba(236,241,252,0.7)'; bg.beginPath(); bg.ellipse(x, 128 + (rnd() - 0.62) * edge(x, 1.5), 2 + rnd() * 5, 2 + rnd() * 4, 0, 0, 6.283); bg.fill(); }
  }
  const boughMap = tex(bc);

  // a tree's shape is built up as flat cards
  const shape = () => ({ pos: [], uv: [], nrm: [], idx: [] });
  const finish = s => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nrm, 3));
    g.setIndex(s.idx);
    return g;
  };
  // a pine: whorls of boughs up the trunk, each bough a flat card and an upright one. The valley's pines are seen close
  // and get the full set; a real hillside has several times as many trees, so each is made of fewer cards.
  const pine = (whorls, per) => {
    const s = shape();
    const card = (a, y, L, W, droop, vertical) => {
      const ca = Math.cos(a), sa = Math.sin(a), cd = Math.cos(droop), sd = Math.sin(droop), base = s.pos.length / 3;
      for (const [x, w] of [[0, -0.5], [1, -0.5], [1, 0.5], [0, 0.5]]) {
        const yy = vertical ? w * W : 0, zz = vertical ? 0 : w * W, xx = x * L + 0.05;
        const rad = xx * cd + yy * sd, upv = -xx * sd + yy * cd;
        s.pos.push(rad * ca - zz * sa, y + upv, rad * sa + zz * ca); s.uv.push(x, w + 0.5);
        s.nrm.push(ca * 0.75, 0.66, sa * 0.75);            // soft, outward-and-up shading
      }
      s.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const fill = 15 / whorls;                              // fewer whorls: each bough is broader, so the tree is as full
    for (let k = 0; k < whorls; k++) {
      const t = k / (whorls - 1), y = 2.0 + t * 8.6, L = 2.9 * Math.pow(1 - t, 0.85) + 0.4, droop = 0.5 - t * 1.1, a0 = rnd() * 6.28;
      for (let b = 0; b < per; b++) {
        const a = a0 + b * 6.283 / per + (rnd() - 0.5) * 0.5, l = L * (0.8 + rnd() * 0.35);
        card(a, y + (rnd() - 0.5) * 0.3, l, l * 0.62 * Math.sqrt(fill), droop, false);
        card(a, y + (rnd() - 0.5) * 0.3, l, l * 0.5 * Math.sqrt(fill), droop, true);
      }
    }
    return finish(s);
  };
  // a broadleaf: three upright cards through the trunk and, in leaf, two level ones, shaded like a ball
  const crown = level => {
    const s = shape(), C = new V3(0, 7, 0), quad = corners => {
      const base = s.pos.length / 3;
      corners.forEach(([x, y, z], k) => {
        s.pos.push(x, y, z); s.uv.push(k === 0 || k === 3 ? 0 : 1, k < 2 ? 0 : 1);
        const n = new V3(x, y + 1.5, z).sub(C).normalize(); s.nrm.push(n.x, n.y, n.z);       // shade it like a ball, not a set of cards
      });
      s.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    for (const a of [0, 1.047, 2.094]) { const cx = Math.cos(a) * 4.2, cz = Math.sin(a) * 4.2; quad([[-cx, 3.2, -cz], [cx, 3.2, cz], [cx, 10.8, cz], [-cx, 10.8, -cz]]); }
    if (level) for (const y of [5.6, 8.2]) quad([[-3.7, y, -3.7], [3.7, y, -3.7], [3.7, y, 3.7], [-3.7, y, 3.7]]);
    return finish(s);
  };
  const leafMap = () => {                                  // a crown of pale leaves, to be coloured tree by tree
    const [lc, lg] = canvas2d(256, 256);
    for (let i = 0; i < 760; i++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 116, v = 100 + rnd() * 105 | 0;
      lg.fillStyle = `rgb(${v * 0.96 | 0},${v},${v * 0.88 | 0})`;
      lg.beginPath(); lg.ellipse(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.88, 5 + rnd() * 7, 3 + rnd() * 4, rnd() * 3.14, 0, 6.283); lg.fill();
    }
    return tex(lc);
  };
  const bareMap = () => {                                  // a winter tree: limbs forking up from the trunk into a haze of twigs, with snow lying on them
    const [lc, lg] = canvas2d(256, 256), tips = [];
    lg.lineCap = 'round';
    const limb = (x, y, a, len, w, depth) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len, l = 44 + rnd() * 26 | 0;
      lg.strokeStyle = `rgb(${l + 14},${l + 2},${l - 12})`; lg.lineWidth = w; lg.beginPath(); lg.moveTo(x, y); lg.lineTo(x2, y2); lg.stroke();
      if (snowy && w > 2.2 && Math.abs(Math.cos(a)) > 0.35) { lg.strokeStyle = 'rgba(236,241,250,0.95)'; lg.lineWidth = w * 0.55; lg.beginPath(); lg.moveTo(x, y - w * 0.45); lg.lineTo(x2, y2 - w * 0.45); lg.stroke(); }
      if (depth === 0) { tips.push([x2, y2, a]); return; }
      for (let k = 0, n = depth > 3 ? 2 : 3; k < n; k++) limb(x2, y2, a + (k - (n - 1) / 2) * (0.5 + rnd() * 0.3) + (rnd() - 0.5) * 0.3, len * (0.7 + rnd() * 0.2), Math.max(1.8, w * 0.62), depth - 1);
    };
    limb(128, 256, -Math.PI / 2, 54, 11, 5);
    for (const [x, y, a] of tips) for (let k = 0; k < 5; k++) {          // fine twigs at the ends: up close they are lines, from far off a brown-grey haze
      const b = a + (rnd() - 0.5) * 1.6, len = 10 + rnd() * 16, l = 58 + rnd() * 30 | 0;
      lg.strokeStyle = snowy && rnd() < 0.2 ? 'rgba(232,238,248,0.95)' : `rgb(${l + 18},${l + 4},${l - 12})`; lg.lineWidth = 1.7; lg.beginPath(); lg.moveTo(x, y); lg.lineTo(x + Math.cos(b) * len, y + Math.sin(b) * len); lg.stroke();
    }
    return tex(lc);
  };
  // the kinds of tree here: each has its foliage, how much of a card must be painted to show, and its trunk
  const pineTrunk = new THREE.CylinderGeometry(0.04, 0.25, 10.8, 6).translate(0, 5.4, 0), leafTrunk = new THREE.CylinderGeometry(0.16, 0.3, 5.2, 6).translate(0, 2.6, 0);
  const kinds = [{ geo: pine(real ? 8 : 15, real ? 4 : 5), map: boughMap, cut: 0.4, trunk: pineTrunk, spots: [] }];
  if (real) kinds.push(LOOK.trees.bare ? { geo: crown(false), map: bareMap(), cut: 0.3, trunk: leafTrunk, spots: [] } : { geo: crown(true), map: leafMap(), cut: 0.4, trunk: leafTrunk, spots: [] });
  const foliage = (map, cut) => {
    const mat = new THREE.MeshStandardMaterial({ map, alphaTest: cut, side: THREE.DoubleSide, roughness: 0.9 });
    mat.onBeforeCompile = s => {
      s.uniforms.uTime = uTime;
      s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wp = instanceMatrix * vec4(0., 0., 0., 1.);
          transformed.x += sin(uTime * 1.1 + wp.x * 0.13 + wp.z * 0.09) * 0.022 * position.y;
          transformed.z += sin(uTime * 0.9 + wp.z * 0.11) * 0.016 * position.y;
        #endif`);
      s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace(/gl_FrontFacing \? 1\.0 : - ?1\.0/, '1.0'));
    };
    return mat;
  };
  const spots = [];
  const built = new Set(), cellKey = (x, z) => Math.floor(x / 10) * 4096 + Math.floor(z / 10);
  if (real) {
    for (const [bx, bz, w] of real.osm.buildings) for (let dx = -w / 2 - 4; dx <= w / 2 + 4; dx += 10) for (let dz = -w / 2 - 4; dz <= w / 2 + 4; dz += 10) built.add(cellKey(bx + dx, bz + dz));
    for (const [x, z] of real.osm.trees) { const nr = nearRoad(x, z); if (!nr || nr.d > 5.5) spots.push([x, meshH(x, z), z, 1]); }     // mapped street and field trees
  }
  for (let n = 0; n < (real ? 320000 : 70000) && spots.length < (real ? 26000 : 7000); n++) {
    const x = (rnd() - 0.5) * TS * 0.78, z = (rnd() - 0.5) * TS * 0.78, nr = nearRoad(x, z), d = nr ? nr.d : 999;
    if (d < 11) continue;
    if (chalets.some(c => (c[0] - x) ** 2 + (c[1] - z) ** 2 < 170)) continue;
    const forest = fbm(x / 140 + 3, z / 140 + 7, 3);
    if (real) {            // trees where the map says there is woodland, and never on a building
      if (!real.wood(x, z) || built.has(cellKey(x, z))) continue;
    } else if (!(forest > 0.53 || (d < 55 && rnd() < (XMAS ? 0.42 : 0.1)))) continue;
    const y = meshH(x, z);
    if (!real && y > 240) continue;
    // conifers and broadleaves grow in stands of their own, mixed where the stands meet
    const share = LOOK.trees.conifer, stand = (fbm(x / 230 + 31, z / 230 + 13, 2) - 0.38) * 2.4 * Math.min(1, 4 * share * (1 - share) + 0.2);
    spots.push([x, y, z, real && rnd() >= share + stand ? 1 : 0]);          // the valley is all pines
  }
  for (const s of spots) kinds[s[3] || 0].spots.push(s);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), sc = new V3(), ps = new V3(), col = new THREE.Color();
  const pick = list => { let r = rnd() * list.reduce((a, c) => a + c[1], 0); for (const [c, n] of list) if ((r -= n) <= 0) return c; return list[0][0]; };
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x33251a, roughness: 1 });
  kinds.forEach((kind, ki) => {
    if (!kind.spots.length) return;
    const fol = new THREE.InstancedMesh(kind.geo, foliage(kind.map, kind.cut), kind.spots.length), trunk = new THREE.InstancedMesh(kind.trunk, trunkMat, kind.spots.length);
    kind.spots.forEach(([x, y, z], i) => {
      const s = 0.9 + rnd() * 0.9;
      ps.set(x, y - 0.3, z); q.setFromAxisAngle(up, rnd() * 6.283); sc.set(s * (0.85 + rnd() * 0.3), s, s * (0.85 + rnd() * 0.3));
      m4.compose(ps, q, sc); fol.setMatrixAt(i, m4); trunk.setMatrixAt(i, m4);
      if (XMAS && xl.p.length < 110000 * 3) {            // fairy lights wound round the trees beside the road
        const nr = nearRoad(x, z);
        if (nr && nr.d < 70 && (nr.d < 45 || rnd() < 0.6)) {
          const many = rnd() < 0.4, a0 = rnd() * 6.283, w = s * (sc.x + sc.z) / (2 * s);
          for (let k = 0; k < 96; k++) {
            const t = (k + rnd() * 0.6) / 96, rad = (2.9 * Math.pow(1 - t, 0.85) + 0.4) * 0.74 * w, a = a0 + t * 58;
            xl.p.push(x + Math.cos(a) * rad, y - 0.3 + (2.0 + t * 8.6) * s - 0.25 * rad, z + Math.sin(a) * rad);
            xl.c.push(...(many ? XL_COLS[rnd() * XL_COLS.length | 0] : XL_COLS[0]));
          }
        }
      }
      // colour: the valley's pines and anything under snow or bare are painted in their own colours and only vary in shade;
      // elsewhere each tree takes one of the season's colours
      if (!plain || (ki === 1 && LOOK.trees.bare)) fol.setColorAt(i, col.setRGB(0.7 + rnd() * 0.3, 0.75 + rnd() * 0.25, 0.6 + rnd() * 0.3));
      else fol.setColorAt(i, col.set(pick(ki ? LOOK.trees.leaf : LOOK.trees.needle)).multiplyScalar(PALE * (0.78 + rnd() * 0.4)));
    });
    for (const m of [fol, trunk]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
  });
  st0.trees = kinds.map(k => k.spots.length);
}

if (xl.p.length) {         // every Christmas light is one glowing point; bright enough to bloom
  const g = new THREE.BufferGeometry(), n = xl.p.length / 3, ph = new Float32Array(n);
  for (let i = 0; i < n; i++) ph[i] = rnd();
  g.setAttribute('position', new THREE.Float32BufferAttribute(xl.p, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(xl.c, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const lights = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uPx: { value: innerHeight * Math.min(devicePixelRatio, 2) / (2 * Math.tan(0.6)) } },
    vertexShader: `uniform float uTime, uPx; attribute vec3 aCol; attribute float aPh; varying vec3 vCol;
      void main(){
        vec4 mv = viewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
        float d = -mv.z, tw = 0.8 + 0.2 * sin(uTime * (1.2 + aPh * 2.5) + aPh * 40.);
        float px = 0.62 * uPx / d; gl_PointSize = clamp(px, 3., 30.);
        vCol = aCol * tw * (1. - smoothstep(450., 1100., d)) * min(1., px / 3.);
      }`,
    fragmentShader: 'varying vec3 vCol; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vCol * (pow(smoothstep(0.5, 0.0, r), 2.) * 5. + smoothstep(0.2, 0.0, r) * 30.), 1.); }'
  }));
  lights.frustumCulled = false; lights.renderOrder = 4; scene.add(lights);
  st0.lights = n;
}
