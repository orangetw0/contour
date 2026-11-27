/* How this place looks at this time of year: the colour of its grass and trees, where snow lies, what riders wear, and
   how its road is surfaced and painted. Set by where the route is (its region and road style) and by the season you choose in
   the Display panel (?season=spring|summer|autumn|winter sets it for one visit). */
import { real, XMAS, P } from '../course/index.js';
import { query } from '../util/dom.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_KEY = 'contour-season';
let season = 'summer';
try { const k = localStorage.getItem(SEASON_KEY); if (SEASONS.includes(k)) season = k; } catch {}
if (SEASONS.includes(query.get('season'))) season = query.get('season');
const set = real && real.look ? real.look : {}, region = set.region || 'temperate';

// grass [r, g, b] multiplies the summer colours; snow is the height in metres where it starts to lie (in winter it lies
// everywhere except round the Mediterranean, where only the tops are white)
const DEEP_SNOW = -1000;
const REGIONS = {
  temperate: { spring: { grass: [0.95, 1.3, 0.62], snow: 2400 }, summer: { grass: [0.95, 1, 0.95], snow: 2500 }, autumn: { grass: [1.35, 0.96, 0.52], snow: 2200 }, winter: { grass: [1.1, 0.95, 0.7], snow: DEEP_SNOW } },
  alpine: { spring: { grass: [0.95, 1.28, 0.62], snow: 1900 }, summer: { grass: [0.95, 1.02, 0.9], snow: 2700 }, autumn: { grass: [1.35, 0.96, 0.52], snow: 2100 }, winter: { grass: [1.05, 0.92, 0.72], snow: DEEP_SNOW } },
  mediterranean: { spring: { grass: [1, 1.22, 0.65], snow: 2600 }, summer: { grass: [1.6, 1.2, 0.62], snow: 3000 }, autumn: { grass: [1.5, 1, 0.6], snow: 2600 }, winter: { grass: [1.2, 0.97, 0.8], snow: 700 } },
  nordic: { spring: { grass: [0.95, 1.25, 0.65], snow: 600 }, summer: { grass: [0.88, 1.05, 0.88], snow: 1300 }, autumn: { grass: [1.38, 0.97, 0.5], snow: 800 }, winter: { grass: [1, 0.92, 0.8], snow: DEEP_SNOW } },
  lowland: { spring: { grass: [0.9, 1.32, 0.6], snow: 9000 }, summer: { grass: [0.9, 1.05, 0.88], snow: 9000 }, autumn: { grass: [1.3, 0.97, 0.55], snow: 9000 }, winter: { grass: [1.05, 0.95, 0.7], snow: DEEP_SNOW } },
  piedmont: { spring: { grass: [0.95, 1.28, 0.6], snow: 9000 }, summer: { grass: [1.05, 1.05, 0.8], snow: 9000 }, autumn: { grass: [1.4, 0.97, 0.5], snow: 9000 }, winter: { grass: [1.25, 1, 0.7], snow: DEEP_SNOW } },
};
// Foliage colours, each a list of [colour, how common]. Trees are painted pale and every tree takes one of these.
const FRESH = [['#7db53c', 3], ['#93c44c', 3], ['#6aa536', 2], ['#a6cf5c', 1]], DEEP = [['#1c420e', 3], ['#24521a', 3], ['#1a3c12', 2], ['#2f6020', 1]],
  BLOSSOM = [['#eebccb', 2], ['#f4e6dc', 2], ['#e293b0', 1]], GOLD = [['#d6a41c', 3], ['#e3b62c', 2]], ORANGE = [['#dc7c18', 3], ['#c9611a', 2]], RED = [['#b0301a', 2], ['#8e2416', 1]],
  BROWN = [['#8a5a22', 2], ['#6e4420', 1]], LATE = [['#5f7a2a', 1]], OLIVE = [['#34502a', 3], ['#46603a', 2], ['#55683e', 1]], FIR = [['#17340d', 3], ['#1c3c16', 2], ['#14301a', 1]], TIPS = [['#2a5418', 2], ['#356422', 1]];
// several lists, each given its share of the trees
const blend = (...parts) => parts.flatMap(([list, share]) => { const sum = list.reduce((a, c) => a + c[1], 0); return list.map(([c, n]) => [c, n / sum * share]); });
// conifer: the share of trees that are conifers. evergreen: the broadleaves keep their leaves in winter. Each season: the
// broadleaves' colours, and (needle) the conifers' where they differ from fir green.
const TREES = {
  temperate: { conifer: 0.15, spring: blend([FRESH, 0.84], [BLOSSOM, 0.16]), summer: DEEP, autumn: blend([GOLD, 0.3], [ORANGE, 0.3], [RED, 0.15], [BROWN, 0.15], [LATE, 0.1]) },
  alpine: { conifer: 0.62, spring: blend([FRESH, 0.95], [BLOSSOM, 0.05]), summer: DEEP, autumn: blend([GOLD, 0.5], [ORANGE, 0.25], [BROWN, 0.15], [LATE, 0.1]), needle: { autumn: blend([FIR, 0.72], [GOLD, 0.28]) } },   // larches turn gold
  mediterranean: { conifer: 0.35, evergreen: true, spring: blend([OLIVE, 0.5], [FRESH, 0.36], [BLOSSOM, 0.14]), summer: OLIVE, autumn: blend([OLIVE, 0.6], [GOLD, 0.18], [BROWN, 0.22]), winter: OLIVE },
  nordic: { conifer: 0.55, spring: FRESH, summer: DEEP, autumn: blend([GOLD, 0.6], [ORANGE, 0.25], [RED, 0.05], [BROWN, 0.1]) },                                              // birch gold
  lowland: { conifer: 0.06, spring: blend([FRESH, 0.88], [BLOSSOM, 0.12]), summer: DEEP, autumn: blend([GOLD, 0.35], [ORANGE, 0.25], [RED, 0.1], [BROWN, 0.2], [LATE, 0.1]) },
  piedmont: { conifer: 0.3, spring: blend([FRESH, 0.8], [BLOSSOM, 0.2]), summer: DEEP, autumn: blend([RED, 0.3], [ORANGE, 0.3], [GOLD, 0.25], [BROWN, 0.1], [LATE, 0.05]) },   // maples and dogwoods
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
const base = (REGIONS[region] || REGIONS.temperate)[season], wood = TREES[region] || TREES.temperate, winter = season === 'winter';
const snow = XMAS || (!real && winter) ? DEEP_SNOW : base.snow;
let low = Infinity; for (const p of P) low = Math.min(low, p.y);          // the lowest point of the road
export const LOOK = {
  season, region, grass: base.grass, snow,
  blade: [base.grass[0] ** 2.2, base.grass[1], base.grass[2] ** 2.2],      // standing grass is darker than the ground and needs a stronger tint to show the season
  snowy: snow + 300 < low,                                          // snow lies all along the road: white ground, laden trees, ploughed banks
  // conifer: their share. leaf, needle: colours for broadleaves and conifers. bare: the broadleaves have dropped their leaves.
  trees: { conifer: wood.conifer, leaf: wood[season] || DEEP, needle: wood.needle?.[season] || (season === 'spring' ? blend([FIR, 0.6], [TIPS, 0.4]) : FIR), bare: winter && !wood.evergreen },
  road: ROADS[set.road] || ROADS.main,
  frost: winter && !XMAS,                                           // a cold road: pale and salted
  wear: XMAS ? 'winter' : season,                                   // what riders dress for
};
