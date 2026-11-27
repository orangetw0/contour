/* The course for this visit. Chosen by the address: ?course=valley (the invented valley), ?course=leckhampton
   (a real road with surveyed terrain), ?course=r:<id> (a route that comes with Contour, with surveyed terrain) or ?course=my:<id> (a route you
   imported, with invented terrain round it).
   Also ?theme=christmas and ?scenery. */
import * as THREE from 'three';
import { $, query } from '../util/dom.js';
import { buildLine, valleyControl, mkPose } from './line.js';
import { unpackRoute } from './route.js';
import { generateTerrain, woodland } from './terrainGen.js';
import { fbm, smooth } from '../util/noise.js';
import { BUILT_IN, loadImported } from './library.js';

const asked = query.get('course') || 'valley';
let imported = null;
if (asked.startsWith('my:')) { try { imported = loadImported(localStorage, asked); } catch { imported = null; } }
// a route that comes with Contour as a file
if (/^r:[a-z0-9-]+$/.test(asked) && BUILT_IN.some(r => r.id === asked)) { try { const res = await fetch(`routes/${asked.slice(2)}.json`); if (res.ok) imported = await res.json(); } catch { imported = null; } }
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
  const route = unpackRoute(imported), survey = imported.ground;
  closed = route.closed;
  let heights = null;
  if (survey) {                 // a route that comes with surveyed ground: 16-bit heights in a file beside it
    try { const res = await fetch(`routes/${asked.slice(2)}.dem`); if (res.ok) { const q = new Uint16Array(await res.arrayBuffer()); if (q.length === (survey.cells + 1) ** 2) heights = Float32Array.from(q, v => survey.min + v / 65535 * (survey.max - survey.min)); } } catch { heights = null; }
  }
  if (heights) {
    const g = survey, half = g.size / 2, cut = 0.5 + (0.5 - g.trees) * 0.3;
    real = { size: g.size, cells: g.cells, h: heights, demMin: g.min, demMax: g.max, name: route.name, road: route.road, geo: route.geo, water: g.water ?? null, look: g.look || null, osm: { buildings: [], trees: [], lines: [], woods: '', credit: '' } };
    // which ground is wooded is not surveyed yet: trees stand in patches below the tree line, thinning as they near it
    real.wood = (x, z) => Math.abs(x) < half && Math.abs(z) < half && (g.water == null || demH(x, z) > g.water + 1.5) && fbm(x / 210 + 17, z / 210 + 29, 3) > cut + 0.25 * smooth(g.treeline - 300, g.treeline, demH(x, z));
    $('credit').textContent = (g.gpx ? 'Road from a GPX file. ' : 'Road © OpenStreetMap contributors. ') + 'Terrain: Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA. Tree cover is estimated.';
  } else {
    const ground = generateTerrain(route.road);
    real = { ...ground, name: route.name, road: route.road, geo: route.geo, generated: true, osm: { buildings: [], trees: [], lines: [], woods: '', credit: '' },
      wood: (x, z) => Math.abs(x) < ground.size / 2 && Math.abs(z) < ground.size / 2 && woodland(x, z) };
    $('credit').textContent = (asked.startsWith('my:') ? 'Your route. ' : '') + 'The road and its gradients are real; the scenery around it is invented.';
  }
}
export { real, closed, mkPose };

export function demH(x, z) {                 // the real ground under a point
  const g = real.cells, w = g + 1, f = v => Math.min(g - 1e-6, Math.max(0, (v + real.size / 2) / (real.size / g)));
  const fx = f(x), fz = f(z), ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, h = real.h;
  return (h[iz * w + ix] * (1 - u) + h[iz * w + ix + 1] * u) * (1 - v) + (h[(iz + 1) * w + ix] * (1 - u) + h[(iz + 1) * w + ix + 1] * u) * v;
}

// Which country the road is in, as a two-letter code ('' when unknown): from the route's own note, else roughly from where it is.
// It decides which side riders keep to and how the turning places at the ends of an open road are built.
const NATIONS = { France: 'FR', Italy: 'IT', Switzerland: 'CH', Spain: 'ES', Netherlands: 'NL', Norway: 'NO', USA: 'US', England: 'GB', Scotland: 'GB', Wales: 'GB' };
function countryOf() {
  if (!real) return '';
  if (real.look && real.look.country) return real.look.country;
  const note = (BUILT_IN.find(r => r.id === COURSE) || {}).note || '', named = Object.keys(NATIONS).find(n => note.includes(n));
  if (named) return NATIONS[named];
  const { lat0: la, lon0: lo } = real.geo || {};
  if (la == null) return '';
  if (la > 49.9 && la < 61 && lo > -11 && (lo < -1.9 || (lo < 1.8 && la > 50.5 && !(lo > 1.3 && la < 51.05)))) return 'GB';     // Britain and Ireland
  if (la > 50.75 && la < 53.6 && lo > 3.3 && lo < 7.2) return 'NL';
  if (la > 24 && la < 50 && lo > -125 && lo < -66) return 'US';
  if ((la > 24 && la < 46 && lo > 123 && lo < 146) || (la > -48 && la < -10 && lo > 112 && lo < 180) || (la > 6 && la < 36 && lo > 68 && lo < 90) || (la > -35 && la < -22 && lo > 16 && lo < 33)) return 'LEFT';   // Japan, Australia and New Zealand, India, southern Africa
  return '';
}
export const COUNTRY = countryOf();
// riders keep left in Britain (and in the invented valley, which was always ridden that way), right elsewhere
export const KEEP = !real || COUNTRY === 'GB' || COUNTRY === 'LEFT' ? -1 : 1;
export const line = buildLine(real ? real.road.map(p => new THREE.Vector3(p[0], p[1], p[2])) : valleyControl(), { closed, keep: KEEP });
export const { LEN, N, P, T, R, at, nearRoad } = line;
// Leckhampton: begin on the lane about 150 m below where the hill steepens, not out in the vale
export const START = COURSE === 'leckhampton' ? 850 : imported ? 5 : 0;
