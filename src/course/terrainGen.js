/* Invents the ground around a road when there is no survey of it: a landscape that agrees with the road's heights
   wherever the road goes, rolls gently beside it and rises to hills further off. Used for imported routes.
   Returns the same kind of height grid a surveyed course has: { size, cells, h, demMin, demMax }. */
import { fbm, ridged, smooth } from '../util/noise.js';

export function generateTerrain(road, { margin = 900 } = {}) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, , z] of road) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const size = Math.ceil((Math.max(x1 - x0, z1 - z0) + 2 * margin) / 240) * 240, cell = size <= 6480 ? 10 : size <= 9600 ? 15 : 20, cells = Math.round(size / cell), w = cells + 1;
  // the lie of the land: the flat slope that best follows the road's heights
  let sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0; const n = road.length;
  for (const [x, y, z] of road) { sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y; }
  const mx = sx / n, mz = sz / n, my = sy / n, a = sxx - n * mx * mx, b = sxz - n * mx * mz, c = szz - n * mz * mz, d = sxy - n * mx * my, e = szy - n * mz * my, det = a * c - b * b;
  const gx = Math.abs(det) > 1e-6 ? (d * c - e * b) / det : 0, gz = Math.abs(det) > 1e-6 ? (a * e - b * d) / det : 0, lim = v => Math.max(-0.25, Math.min(0.25, v));
  const plane = (x, z) => my + lim(gx) * (x - mx) + lim(gz) * (z - mz);
  // how far the road sits above or below that slope, spread out from the road over a coarse grid
  const anchors = []; for (let i = 0; i < n; i += 4) anchors.push([road[i][0], road[i][2], road[i][1] - plane(road[i][0], road[i][2])]);
  const C = 4, cw = Math.ceil(cells / C) + 1, off = new Float32Array(cw * cw), near = new Float32Array(cw * cw);
  for (let j = 0; j < cw; j++) for (let i = 0; i < cw; i++) {
    const x = -size / 2 + i * C * cell, z = -size / 2 + j * C * cell;
    let ws = 0, vs = 0, dm = Infinity;
    for (const [ax, az, r] of anchors) { const d2 = (ax - x) ** 2 + (az - z) ** 2, wt = 1 / (d2 * d2 + 4e6); ws += wt; vs += wt * r; if (d2 < dm) dm = d2; }
    off[j * cw + i] = vs / ws; near[j * cw + i] = Math.sqrt(dm);
  }
  // the nearest stretch of road to any point, found quickly: road points sorted into 60 m squares
  const B = 60, bins = new Map(), key = (i, j) => i * 100003 + j;
  road.forEach((p, k) => { const q = key(Math.floor(p[0] / B), Math.floor(p[2] / B)); (bins.get(q) || bins.set(q, []).get(q)).push(k); });
  const roadNear = (x, z) => {
    let best = Infinity, y = 0; const bi = Math.floor(x / B), bj = Math.floor(z / B);
    for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) { const list = bins.get(key(bi + di, bj + dj)); if (list) for (const k of list) { const d2 = (road[k][0] - x) ** 2 + (road[k][2] - z) ** 2; if (d2 < best) { best = d2; y = road[k][1]; } } }
    return best < Infinity ? [Math.sqrt(best), y] : null;
  };
  const h = new Float32Array(w * w); let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = -size / 2 + i * cell, z = -size / 2 + j * cell, fi = Math.min(cw - 1.001, i / C), fj = Math.min(cw - 1.001, j / C), i0 = Math.floor(fi), j0 = Math.floor(fj), u = fi - i0, v = fj - j0;
    const mix = g => (g[j0 * cw + i0] * (1 - u) + g[j0 * cw + i0 + 1] * u) * (1 - v) + (g[(j0 + 1) * cw + i0] * (1 - u) + g[(j0 + 1) * cw + i0 + 1] * u) * v;
    const dist = mix(near), away = smooth(40, 320, dist), far = smooth(450, 1400, dist);
    let y = plane(x, z) + mix(off) * (1 - 0.55 * far);
    y += away * ((fbm(x / 380 + 3, z / 380 + 7, 4) - 0.5) * 46 + (fbm(x / 90, z / 90, 3) - 0.5) * 9);          // rolling ground beside the road
    y += far * (40 + ridged(x / 700 + 11, z / 700 + 5, 4) * 230 + fbm(x / 260 + 40, z / 260, 4) * 60);            // hills on the skyline
    const rn = dist < 190 ? roadNear(x, z) : null;                  // close to the road the ground is the road's own height, easing out to the wider land
    if (rn) y = rn[1] + (y - rn[1]) * smooth(18, 170, rn[0]);
    h[j * w + i] = y; lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return { size, cells, h, demMin: lo, demMax: hi };
}

// where trees grow on invented ground: in patches, away from the tarmac
export const woodland = (x, z) => fbm(x / 210 + 17, z / 210 + 29, 3) > 0.56;
