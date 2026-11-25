/* The course for this visit. Chosen by the address: ?course=valley (the invented valley), ?course=leckhampton
   (a real road with surveyed terrain), or ?course=my:<id> (a route you imported, with invented terrain round it).
   Also ?theme=christmas and ?scenery. */
import * as THREE from 'three';
import { $, query } from '../util/dom.js';
import { buildLine, valleyControl, mkPose } from './line.js';
import { unpackRoute } from './route.js';
import { generateTerrain, woodland } from './terrainGen.js';
import { BUILT_IN, loadImported } from './library.js';

const asked = query.get('course') || 'valley';
let imported = null;
if (asked.startsWith('my:')) { try { imported = loadImported(localStorage, asked); } catch { imported = null; } }
export const COURSE = imported ? asked : asked === 'leckhampton' ? 'leckhampton' : 'valley';
export const COURSE_NAME = imported ? imported.name : BUILT_IN.find(r => r.id === COURSE).name;
export const COURSE_NAMES = Object.fromEntries(BUILT_IN.map(r => [r.id, r.name]));
// ?theme=christmas: the same valley under snow at dusk, with lights in the trees and a few chalets
export const XMAS = query.get('theme') === 'christmas' && COURSE === 'valley';
// Scenery mode (?scenery): the ride drifts along on its own at a gentle pace with nothing on screen and the weather
// slowly changing, for leaving on in the background. ?scenery=nobars also hides the handlebars.
export const SCENERY = query.get('scenery');

let real = null, closed = true;
if (COURSE === 'leckhampton') {
  $('loading').textContent = 'Building Leckhampton Hill…';
  const addScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('missing ' + src)); document.head.append(s); });
  const DATA = 3;          // bump when the course files change, so browsers don't reuse an old copy
  await addScript(`assets/${COURSE}.js?v=${DATA}`);
  await addScript(`assets/${COURSE}_osm.js?v=${DATA}`).catch(() => {});          // buildings, woods and hedges are optional
  real = window.RIDE_COURSES[COURSE];
  real.osm = real.osm || { buildings: [], trees: [], lines: [], woods: '', credit: '' };
  real.pastoral = true;                   // dressed as the 19th-century hill: sheep, hay stooks
  const wb = Uint8Array.from(atob(real.osm.woods), c => c.charCodeAt(0));
  real.wood = (x, z) => {                 // is this spot mapped as woodland?
    const g = real.cells, ix = Math.round((x + real.size / 2) / (real.size / g)), iz = Math.round((z + real.size / 2) / (real.size / g));
    if (ix < 0 || iz < 0 || ix > g || iz > g) return false;
    const i = iz * (g + 1) + ix; return ((wb[i >> 3] >> (i & 7)) & 1) === 1;
  };
  const raw = Uint8Array.from(atob(real.dem), c => c.charCodeAt(0)), q = new Uint16Array(raw.buffer);
  real.h = Float32Array.from(q, v => real.demMin + v / 65535 * (real.demMax - real.demMin));     // surveyed ground heights, metres
  $('credit').textContent = real.credit + ' ' + real.osm.credit;
} else if (imported) {
  // an imported route: the road and its heights are real; the ground around it is invented to fit
  $('loading').textContent = `Building ${imported.name}…`;
  await new Promise(r => setTimeout(r, 30));                                       // let the message show before the work starts
  const route = unpackRoute(imported), ground = generateTerrain(route.road);
  closed = route.closed;
  real = { ...ground, name: route.name, road: route.road, geo: route.geo, generated: true, osm: { buildings: [], trees: [], lines: [], woods: '', credit: '' },
    wood: (x, z) => Math.abs(x) < ground.size / 2 && Math.abs(z) < ground.size / 2 && woodland(x, z) };
  $('credit').textContent = 'Your route. The road and its gradients are from your file; the scenery around it is invented.';
}
export { real, closed, mkPose };

export function demH(x, z) {                 // the real ground under a point
  const g = real.cells, w = g + 1, f = v => Math.min(g - 1e-6, Math.max(0, (v + real.size / 2) / (real.size / g)));
  const fx = f(x), fz = f(z), ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, h = real.h;
  return (h[iz * w + ix] * (1 - u) + h[iz * w + ix + 1] * u) * (1 - v) + (h[(iz + 1) * w + ix] * (1 - u) + h[(iz + 1) * w + ix + 1] * u) * v;
}

export const line = buildLine(real ? real.road.map(p => new THREE.Vector3(p[0], p[1], p[2])) : valleyControl(), { closed });
export const { LEN, N, P, T, R, at, nearRoad } = line;
// Leckhampton: begin on the lane about 150 m below where the hill steepens, not out in the vale
export const START = COURSE === 'leckhampton' ? 850 : imported ? 5 : 0;
