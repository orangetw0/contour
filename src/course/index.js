/* The course for this visit: the invented valley, or a real road built from survey data.
   Chosen by the address: ?course=leckhampton, ?theme=christmas, ?scenery. */
import * as THREE from 'three';
import { $, query } from '../util/dom.js';
import { buildLine, valleyControl, mkPose } from './line.js';

export const COURSE = query.get('course') === 'leckhampton' ? 'leckhampton' : 'valley';
// ?theme=christmas: the same valley under snow at dusk, with lights in the trees and a few chalets
export const XMAS = query.get('theme') === 'christmas' && COURSE === 'valley';
// Scenery mode (?scenery): the ride drifts along on its own at a gentle pace with nothing on screen and the weather
// slowly changing, for leaving on in the background. ?scenery=nobars also hides the handlebars.
export const SCENERY = query.get('scenery');
export const COURSE_NAMES = { valley: 'Valley', leckhampton: 'Leckhampton' };

let real = null;
if (COURSE !== 'valley') {
  $('loading').textContent = 'Building Leckhampton Hill…';
  const addScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('missing ' + src)); document.head.append(s); });
  const DATA = 3;          // bump when the course files change, so browsers don't reuse an old copy
  await addScript(`assets/${COURSE}.js?v=${DATA}`);
  await addScript(`assets/${COURSE}_osm.js?v=${DATA}`).catch(() => {});          // buildings, woods and hedges are optional
  real = window.RIDE_COURSES[COURSE];
  real.osm = real.osm || { buildings: [], trees: [], lines: [], woods: '', credit: '' };
  const wb = Uint8Array.from(atob(real.osm.woods), c => c.charCodeAt(0));
  real.wood = (x, z) => {                 // is this spot mapped as woodland?
    const g = real.cells, ix = Math.round((x + real.size / 2) / (real.size / g)), iz = Math.round((z + real.size / 2) / (real.size / g));
    if (ix < 0 || iz < 0 || ix > g || iz > g) return false;
    const i = iz * (g + 1) + ix; return ((wb[i >> 3] >> (i & 7)) & 1) === 1;
  };
  const raw = Uint8Array.from(atob(real.dem), c => c.charCodeAt(0)), q = new Uint16Array(raw.buffer);
  real.h = Float32Array.from(q, v => real.demMin + v / 65535 * (real.demMax - real.demMin));     // surveyed ground heights, metres
  $('credit').textContent = real.credit + ' ' + real.osm.credit;
}
export { real, mkPose };

export function demH(x, z) {                 // the real ground under a point
  const g = real.cells, w = g + 1, f = v => Math.min(g - 1e-6, Math.max(0, (v + real.size / 2) / (real.size / g)));
  const fx = f(x), fz = f(z), ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, h = real.h;
  return (h[iz * w + ix] * (1 - u) + h[iz * w + ix + 1] * u) * (1 - v) + (h[(iz + 1) * w + ix] * (1 - u) + h[(iz + 1) * w + ix + 1] * u) * v;
}

export const line = buildLine(real ? real.road.map(p => new THREE.Vector3(p[0], p[1], p[2])) : valleyControl());
export const { LEN, N, P, T, R, at, nearRoad } = line;
// Leckhampton: begin on the lane about 150 m below where the hill steepens, not out in the vale
export const START = real ? 850 : 0;
