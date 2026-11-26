/* Turns a line of latitude, longitude and height into a course: metres on a flat patch of ground centred on the
   route, evenly spaced points, heights smoothed enough to ride, and the numbers a rider wants to know. Pure maths. */
const M_PER_DEG = 111194.9;                        // metres in a degree of latitude
export const MAX_EXTENT = 25000;                   // metres: the biggest patch of world the ride can build for now

/* points: [{ lat, lon, ele }] in order. Returns { name, closed, geo, road: [[x, y, z]], length, ascent, descent, extent,
   centre: [lat, lon], low, high }. x is east, z is south, y is height, all in metres. */
export function buildRoute(points, { name = 'Route', spacing = 15, smooth = 75, asIs = false, loop = null } = {}) {
  if (!points || points.length < 2) throw new Error('A route needs at least two points.');
  let la0 = Infinity, la1 = -Infinity, lo0 = Infinity, lo1 = -Infinity;
  for (const p of points) { la0 = Math.min(la0, p.lat); la1 = Math.max(la1, p.lat); lo0 = Math.min(lo0, p.lon); lo1 = Math.max(lo1, p.lon); }
  const lat0 = (la0 + la1) / 2, lon0 = (lo0 + lo1) / 2, kx = M_PER_DEG * Math.cos(lat0 * Math.PI / 180);
  const raw = points.map(p => [(p.lon - lon0) * kx, p.ele, -(p.lat - lat0) * M_PER_DEG]);
  const extent = Math.max((lo1 - lo0) * kx, (la1 - la0) * M_PER_DEG);
  if (extent > MAX_EXTENT) throw new RangeError(`This route covers ${(extent / 1000).toFixed(0)} km of ground; the most that fits for now is ${MAX_EXTENT / 1000} km. Try one climb or one loop from it.`);
  // distance along the ground at each point, skipping points that don't move
  const pts = [raw[0]], dist = [0];
  for (let i = 1; i < raw.length; i++) { const a = pts[pts.length - 1], d = Math.hypot(raw[i][0] - a[0], raw[i][2] - a[2]); if (d > 0.5) { pts.push(raw[i]); dist.push(dist[dist.length - 1] + d); } }
  const total = dist[dist.length - 1];
  if (pts.length < 2 || total < 200) throw new Error('This route is shorter than 200 m.');
  const closed = loop !== null ? loop : Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][2] - pts[pts.length - 1][2]) < 40 && total > 500;
  // evenly spaced points along it
  // asIs: the points are already evenly spaced and smoothed (a route rebuilt from storage), so keep them exactly
  const n = asIs ? pts.length - (closed ? 0 : 1) : Math.max(8, Math.round(total / spacing)), step = total / n, count = asIs ? pts.length : closed ? n : n + 1, road = asIs ? pts.map(p => p.slice()) : [];
  for (let i = 0, k = 1; !asIs && i < count; i++) {
    const d = i * step; while (k < dist.length - 1 && dist[k] < d) k++;
    const t = (d - dist[k - 1]) / (dist[k] - dist[k - 1] || 1), a = pts[k - 1], b = pts[k];
    road.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  // recorded heights are noisy: average them over a stretch of road, twice, so gradients change the way roads do
  const w = Math.max(1, Math.round(smooth / step / 2)), at = i => closed ? road[((i % count) + count) % count][1] : road[Math.min(count - 1, Math.max(0, i))][1];
  for (let pass = 0; !asIs && pass < 2; pass++) { const h = road.map((_, i) => { let s = 0; for (let k = -w; k <= w; k++) s += at(i + k); return s / (2 * w + 1); }); h.forEach((y, i) => { road[i][1] = y; }); }
  let ascent = 0, descent = 0, low = Infinity, high = -Infinity;
  for (let i = 0; i < count; i++) { const y = road[i][1]; low = Math.min(low, y); high = Math.max(high, y); if (i) { const d = y - road[i - 1][1]; if (d > 0) ascent += d; else descent -= d; } }
  for (const p of road) { p[0] = +p[0].toFixed(2); p[1] = +p[1].toFixed(2); p[2] = +p[2].toFixed(2); }
  const length = asIs && closed ? total + Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][2] - pts[pts.length - 1][2]) : total;
  return {
    name, closed, road, length, ascent, descent, extent, low, high, centre: [lat0, lon0],
    // local metres back to latitude and longitude: lat = lat0 + m[0] x + m[1] z, lon = lon0 + m[2] x + m[3] z
    geo: { lat0, lon0, m: [0, -1 / M_PER_DEG, 1 / kx, 0] },
  };
}

// a route as it is kept in the browser: just enough to rebuild it
export const packRoute = (name, route) => ({ name, at: route.centre.map(v => +v.toFixed(4)), km: +(route.length / 1000).toFixed(1), up: Math.round(route.ascent), closed: route.closed,
  pts: route.road.map(([x, y, z]) => [+(route.geo.lat0 + route.geo.m[1] * z).toFixed(6), +(route.geo.lon0 + route.geo.m[2] * x).toFixed(6), +y.toFixed(1)]) });
export const unpackRoute = packed => buildRoute(packed.pts.map(([lat, lon, ele]) => ({ lat, lon, ele })), { name: packed.name, asIs: true, loop: !!packed.closed });
