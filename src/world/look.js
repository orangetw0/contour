/* How this place looks at this time of year: the colour of its grass and trees, where snow lies, and how its road
   is surfaced and painted. Set by where the route is (its region and road style) and by the season you choose in
   the Display panel (?season=spring|summer|autumn|winter sets it for one visit). */
import { real, XMAS } from '../course/index.js';
import { query } from '../util/dom.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_KEY = 'contour-season';
let season = 'summer';
try { const k = localStorage.getItem(SEASON_KEY); if (SEASONS.includes(k)) season = k; } catch {}
if (SEASONS.includes(query.get('season'))) season = query.get('season');
const set = real && real.look ? real.look : {}, region = set.region || 'temperate';

// grass [r, g, b] and tree tints multiply the summer colours; snow is the height in metres where it starts to lie
const REGIONS = {
  temperate: { spring: { grass: [0.95, 1.12, 0.8], tree: [0.95, 1.15, 0.8], snow: 2400 }, summer: { grass: [1, 1, 1], tree: [1, 1, 1], snow: 2500 }, autumn: { grass: [1.15, 0.95, 0.7], tree: [1.9, 1.05, 0.45], snow: 2200 }, winter: { grass: [0.95, 0.85, 0.7], tree: [0.8, 0.62, 0.5], snow: 350 } },
  alpine: { spring: { grass: [0.95, 1.1, 0.8], tree: [0.9, 1.05, 0.85], snow: 1900 }, summer: { grass: [1, 1.02, 0.9], tree: [0.8, 0.95, 0.85], snow: 2700 }, autumn: { grass: [1.2, 0.95, 0.65], tree: [1.7, 1.1, 0.5], snow: 2100 }, winter: { grass: [0.9, 0.85, 0.75], tree: [0.7, 0.8, 0.75], snow: 700 } },
  mediterranean: { spring: { grass: [1.05, 1.05, 0.8], tree: [0.85, 0.95, 0.75], snow: 2600 }, summer: { grass: [1.45, 1.15, 0.7], tree: [0.8, 0.88, 0.7], snow: 3000 }, autumn: { grass: [1.3, 1.05, 0.7], tree: [0.95, 0.9, 0.65], snow: 2600 }, winter: { grass: [1, 1, 0.8], tree: [0.8, 0.88, 0.72], snow: 1500 } },
  nordic: { spring: { grass: [0.95, 1.05, 0.8], tree: [0.8, 1, 0.8], snow: 600 }, summer: { grass: [0.9, 1.05, 0.85], tree: [0.75, 0.95, 0.8], snow: 1300 }, autumn: { grass: [1.2, 0.95, 0.6], tree: [1.8, 1.2, 0.45], snow: 800 }, winter: { grass: [0.9, 0.9, 0.85], tree: [0.7, 0.8, 0.8], snow: -100 } },
  lowland: { spring: { grass: [0.9, 1.15, 0.75], tree: [0.95, 1.15, 0.8], snow: 9000 }, summer: { grass: [0.95, 1.08, 0.85], tree: [1, 1, 1], snow: 9000 }, autumn: { grass: [1.05, 1, 0.75], tree: [1.8, 1.1, 0.45], snow: 9000 }, winter: { grass: [0.9, 0.88, 0.72], tree: [0.8, 0.62, 0.5], snow: 9000 } },
  piedmont: { spring: { grass: [0.95, 1.1, 0.75], tree: [0.95, 1.15, 0.8], snow: 9000 }, summer: { grass: [1.05, 1.05, 0.8], tree: [0.9, 1, 0.85], snow: 9000 }, autumn: { grass: [1.25, 1, 0.65], tree: [2, 0.95, 0.4], snow: 9000 }, winter: { grass: [1.2, 1, 0.75], tree: [0.85, 0.65, 0.5], snow: 9000 } },
};
// the road: tint over the tarmac scan [r, g, b, strength], edge lines, centre line, and whether it is laid in stone setts
const ROADS = {
  main: { tint: [8, 8, 12, 0.22], edge: 'solid', centre: 'dashed' },                  // a two-lane road with full markings
  pass: { tint: [70, 70, 74, 0.2], edge: 'solid', centre: 'none' },                   // a mountain road: weathered grey, edge lines only
  lane: { tint: [150, 140, 120, 0.3], edge: 'none', centre: 'none' },                 // a sun-bleached lane with no paint
  dike: { tint: [30, 28, 30, 0.3], edge: 'dashed', centre: 'none' },                  // a Dutch polder road: broken edge lines, no centre line
  us: { tint: [40, 38, 36, 0.2], edge: 'solid', centre: 'yellow' },                   // double yellow down the middle
  setts: { tint: [120, 116, 108, 0.35], edge: 'none', centre: 'none', setts: true },  // granite setts
};
const base = (REGIONS[region] || REGIONS.temperate)[season];
export const LOOK = {
  season, region, grass: base.grass, tree: base.tree, snow: base.snow,
  road: ROADS[set.road] || ROADS.main,
  frost: season === 'winter' && !XMAS && base.snow < 9000,          // a cold road: pale and salted
};
