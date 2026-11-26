/* Builds a route that comes with Contour from the real world: the road from OpenStreetMap (through the OSRM router),
   heights and the ground around it from the Copernicus 30 m elevation model.
   Usage: node tools/build_route.mjs <route-id | all>      (routes are listed in tools/routes.mjs)
   Writes public/routes/<id>.json (the road), public/routes/<id>.dem (the ground, 16-bit heights) and
   src/course/routeFiles.js (the list the app shows). Downloads are kept in /tmp/dem. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fromArrayBuffer } from 'geotiff';
import { buildRoute, packRoute, unpackRoute } from '../src/course/route.js';
import { ROUTES } from './routes.mjs';

const CACHE = '/tmp/dem', OUT = new URL('../public/routes/', import.meta.url);
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const curl = (url, file) => execFileSync('curl', ['-sS', '--fail', '--retry', '3', '-m', '300', '-o', file, url]);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- elevation: one-degree Copernicus tiles, read whole and kept in memory
const tiles = new Map();
async function tile(lat, lon) {
  const la = Math.floor(lat), lo = Math.floor(lon), key = `${la},${lo}`;
  if (tiles.has(key)) return tiles.get(key);
  const name = `Copernicus_DSM_COG_10_${la < 0 ? 'S' : 'N'}${String(Math.abs(la)).padStart(2, '0')}_00_${lo < 0 ? 'W' : 'E'}${String(Math.abs(lo)).padStart(3, '0')}_00_DEM`, file = `${CACHE}/${name}.tif`;
  let t = null;
  try {
    if (!fs.existsSync(file)) curl(`https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`, file);
    const buf = fs.readFileSync(file), img = await (await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))).getImage();
    const [ox, oy] = img.getOrigin(), [rx, ry] = img.getResolution();
    t = { w: img.getWidth(), h: img.getHeight(), ox, oy, rx, ry, d: (await img.readRasters({ interleave: true })) };
  } catch { t = null; }                    // no tile: open sea
  tiles.set(key, t); return t;
}
async function height(lat, lon) {
  const t = await tile(lat, lon); if (!t) return 0;
  // heights sit at pixel centres
  const fx = Math.min(t.w - 1.001, Math.max(0, (lon - t.ox) / t.rx - 0.5)), fy = Math.min(t.h - 1.001, Math.max(0, (lat - t.oy) / t.ry - 0.5));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, d = t.d, w = t.w;
  return (d[j * w + i] * (1 - u) + d[j * w + i + 1] * u) * (1 - v) + (d[(j + 1) * w + i] * (1 - u) + d[(j + 1) * w + i + 1] * u) * v;
}

// ---- the road: OSRM follows real roads through the waypoints
function osrm(way, closed) {
  const pts = closed ? [...way, way[0]] : way, file = `${CACHE}/osrm.json`;
  curl(`https://router.project-osrm.org/route/v1/driving/${pts.map(([la, lo]) => `${lo},${la}`).join(';')}?overview=full&geometries=geojson&continue_straight=true&steps=true`, file);
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (r.code !== 'Ok') throw new Error('router: ' + r.code);
  // the roads it took, to check against a map
  const names = []; for (const leg of r.routes[0].legs) for (const st of leg.steps) { const n = st.name || st.ref || '?', last = names[names.length - 1]; if (last && last[0] === n) last[1] += st.distance; else names.push([n, st.distance]); }
  if (process.env.NAMES === '2') for (const leg of r.routes[0].legs) for (const st of leg.steps) if (st.distance > 150) { const c = st.geometry.coordinates[st.geometry.coordinates.length >> 1]; console.log(`    ${st.name || st.ref || '?'} ${(st.distance / 1000).toFixed(1)} km  [${c[1].toFixed(4)}, ${c[0].toFixed(4)}]`); }
  if (process.env.NAMES) console.log('  ' + names.filter(n => n[1] > 60).map(n => `${n[0]} ${(n[1] / 1000).toFixed(1)}`).join(' > '));
  return r.routes[0].geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
}

async function build(spec) {
  let route;
  if (spec.keep) route = unpackRoute(JSON.parse(fs.readFileSync(new URL(`${spec.id}.json`, OUT), 'utf8')));       // a GPX route already in the repo: keep its road and heights
  else {
    const pts = osrm(spec.way, !!spec.loop);
    for (const p of pts) p.ele = await height(p.lat, p.lon);
    // a waypoint set beside the road, not on it, makes the router ride out to it and back: cut those spurs out
    const kx = 111195 * Math.cos(pts[0].lat * Math.PI / 180), gap = (a, b) => Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 111195);
    for (let i = 0, cut = 0; i < pts.length - 4; i++) {
      let j = -1, run = 0;
      for (let k = i + 1; k < pts.length && run < 4000; k++) { run += gap(pts[k - 1], pts[k]); if (k > i + 2 && run > 30 && gap(pts[i], pts[k]) < 7) j = k; }
      if (j > 0) { pts.splice(i + 1, j - i); if (++cut > 200) break; }
    }
    if (spec.trim) {                       // a climb: keep only the road between its lowest and highest points
      let a = 0, b = 0; pts.forEach((p, i) => { if (p.ele < pts[a].ele) a = i; if (p.ele > pts[b].ele) b = i; });
      if (b > a) pts.splice(b + 1), pts.splice(0, a);
    }
    route = buildRoute(pts, { name: spec.name, smooth: spec.smooth || 140, loop: !!spec.loop });
  }
  const road = route.road, g = route.geo;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, , z] of road) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const need = Math.max(x1 - x0, z1 - z0) + 2 * (spec.margin || 1500), cell = Math.max(10, Math.ceil(need / 640 / 5) * 5), cells = Math.ceil(need / cell / 2) * 2, size = cells * cell, w = cells + 1;
  // nearest road point, found quickly
  const B = 80, bins = new Map(), key = (i, j) => i * 100003 + j;
  road.forEach((p, k) => { const q = key(Math.floor(p[0] / B), Math.floor(p[2] / B)); (bins.get(q) || bins.set(q, []).get(q)).push(k); });
  const reach = Math.max(70, cell * 4), near = Math.max(8, cell * 0.8), R = Math.ceil(reach / B);
  const h = new Float32Array(w * w); let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = -size / 2 + i * cell, z = -size / 2 + j * cell;
    let y = await height(g.lat0 + g.m[1] * z, g.lon0 + g.m[2] * x);
    // the survey is coarser than a road: beside the tarmac the ground takes the road's height and eases out to the survey
    let best = Infinity, ry = 0; const bi = Math.floor(x / B), bj = Math.floor(z / B);
    for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) { const list = bins.get(key(bi + di, bj + dj)); if (list) for (const k of list) { const d2 = (road[k][0] - x) ** 2 + (road[k][2] - z) ** 2; if (d2 < best) { best = d2; ry = road[k][1]; } } }
    if (best < reach * reach) y = ry + (y - ry) * smooth(near, reach, Math.sqrt(best));
    h[j * w + i] = y; lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  // lakes and the sea are dead level in the survey: find the commonest level and sink that water's bed below it
  const flat = new Map(), wet = new Uint8Array(w * w), e = 45 / 111195;
  for (let j = 0; j < w; j += 1) for (let i = 0; i < w; i += 1) {
    const x = -size / 2 + i * cell, z = -size / 2 + j * cell, la = g.lat0 + g.m[1] * z, lon = g.lon0 + g.m[2] * x, c = await height(la, lon);
    if (Math.abs(await height(la + e, lon) - c) < 0.02 && Math.abs(await height(la - e, lon + 1.5 * e) - c) < 0.02 && Math.abs(await height(la - e, lon - 1.5 * e) - c) < 0.02) { wet[j * w + i] = 1; const k = Math.round(c * 2) / 2; flat.set(k, (flat.get(k) || 0) + 1); }
  }
  let water = null, most = w * w * 0.004; for (const [k, n] of flat) if (n > most && spec.water !== false) { most = n; water = k; }
  if (water !== null) { for (let k = 0; k < h.length; k++) if (wet[k] && Math.abs(h[k] - water) < 0.8) h[k] = water - 6; lo = Math.min(lo, water - 6); }
  const q = new Uint16Array(w * w); for (let k = 0; k < q.length; k++) q[k] = Math.round((h[k] - lo) / (hi - lo || 1) * 65535);
  fs.writeFileSync(new URL(`${spec.id}.dem`, OUT), Buffer.from(q.buffer));
  const packed = packRoute(spec.name || route.name, route);
  packed.ground = { size, cells, min: +lo.toFixed(1), max: +hi.toFixed(1), treeline: spec.treeline ?? 1900, trees: spec.trees ?? 0.4, ...(spec.keep ? { gpx: true } : {}), ...(water !== null ? { water } : {}) };
  fs.writeFileSync(new URL(`${spec.id}.json`, OUT), JSON.stringify(packed));
  const grade = route.closed ? '' : `, ${(100 * (route.high - route.low) / route.length).toFixed(1)}% mean`;
  console.log(`${spec.id}: ${packed.km} km, ${packed.up} m up, ${route.low.toFixed(0)}-${route.high.toFixed(0)} m${grade}, ${(route.extent / 1000).toFixed(1)} km across, ${cell} m cells x ${cells}, ${route.closed ? 'loop' : 'open'}${water !== null ? `, water at ${water} m` : ''}`);
  return { id: 'r:' + spec.id, name: packed.name, note: spec.note || '', km: packed.km, up: packed.up, closed: packed.closed, at: packed.at };
}

const want = process.argv[2];
if (!want) { console.error('usage: node tools/build_route.mjs <route-id | all>'); process.exit(1); }
const listFile = new URL('../src/course/routeFiles.js', import.meta.url);
let list = []; try { list = (await import(listFile.href)).ROUTE_FILES.slice(); } catch { list = []; }
for (const spec of ROUTES) {
  if (want !== 'all' && want !== spec.id) continue;
  try { const row = await build(spec), at = list.findIndex(r => r.id === row.id); if (at >= 0) list[at] = row; else list.push(row); }
  catch (e) { console.error(`${spec.id}: FAILED ${e.message}`); }
}
const order = ROUTES.map(r => 'r:' + r.id); list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
fs.writeFileSync(listFile, `// Made by tools/build_route.mjs: the routes kept as files in public/routes. Edit tools/routes.mjs, not this.\nexport const ROUTE_FILES = [\n${list.map(r => '  ' + JSON.stringify(r) + ',').join('\n')}\n];\n`);
