/* Finds the climb ahead of a rider, if there is one worth showing.
   height(d): the road's height d metres ahead (behind, when d is negative). limit: how far the road goes on (metres).
   behind: how far it goes back; given that, a rider already on the climb gets the whole of it, from its foot.
   threshold: the gradient in % that counts as a climb. Returns null, or { start, end, gain, avg, step, from, heights }:
   distances in metres ahead of the rider (start is negative once the foot is behind), gain in metres, avg in %, and
   the heights sampled every `step` metres from `from` (0, or a little before a foot that is behind) to past the top. */
export function climbAhead(height, { limit = Infinity, behind = 0, threshold = 3, step = 25, look = 400, max = 15000, minGain = 12 } = {}) {
  const far = Math.min(limit, max), n = Math.floor(far / step);
  if (n < 4) return null;
  const h = new Array(n + 1); for (let i = 0; i <= n; i++) h[i] = height(i * step);
  const grade = (i, span) => { const j = Math.min(n, i + span); return j > i ? (h[j] - h[i]) / ((j - i) * step) * 100 : 0; };
  // where it begins: the first stretch of 200 m, starting within `look` metres, that is steep enough
  let a = -1; for (let i = 0; i <= Math.min(n - 1, Math.round(look / step)); i++) if (grade(i, 8) >= threshold) { a = i; break; }
  if (a < 0) return null;
  while (a < n - 8 && grade(a, 2) < threshold / 2) a++;            // step past the flat run-in to where the road tilts up
  // where it ends: the road keeps rising, allowing short flats, until 300 m ahead gains almost nothing
  let b = a; while (b < n && grade(b, 12) > 1) b++;
  let top = a; for (let i = a; i <= Math.min(n, b + 12); i++) if (h[i] > h[top]) top = i;
  // already on it: walk back down the same way to the foot, and keep a short run-in before that
  const back = [h[0]], nb = a === 0 ? Math.floor(Math.min(behind, max) / step) : 0;
  const hb = i => back[i] ??= height(-i * step), fall = i => { const j = Math.min(nb, i + 12); return j > i ? (hb(i) - hb(j)) / ((j - i) * step) * 100 : 0; };
  let k = 0; while (k < nb && fall(k) > 1) k++;
  let foot = 0; for (let i = 0; i <= Math.min(nb, k + 12); i++) if (hb(i) < hb(foot)) foot = i;
  const first = foot ? Math.min(nb, foot + 6) : 0, low = foot ? hb(foot) : h[a], gain = h[top] - low, start = foot ? -foot * step : a * step;
  if (top <= a || gain < minGain) return null;
  const heights = h.slice(0, Math.min(n, top + 6) + 1); for (let i = 1; i <= first; i++) heights.unshift(hb(i));
  return { start, end: top * step, gain, avg: gain / (top * step - start) * 100, step, from: 0 - first * step, heights };
}

/* Where a rider is on a climb found earlier. c: what climbAhead returned; d: how far the rider has gone since then
   (metres). Returns { height, toFoot, toTop, toGain, avg }: the road's height where the rider is, the distance left
   to the foot and to the top, the metres still to climb, and the average gradient of what is left, in %. */
export function climbProgress(c, d) {
  const at = x => { const f = Math.max(0, Math.min(c.heights.length - 1, (x - c.from) / c.step)), i = Math.min(c.heights.length - 2, Math.floor(f)); return c.heights[i] + (c.heights[i + 1] - c.heights[i]) * (f - i); };
  const height = at(d), toTop = Math.max(0, c.end - d), from = Math.max(d, c.start), toGain = Math.max(0, at(c.end) - at(from));
  return { height, toFoot: Math.max(0, c.start - d), toTop, toGain, avg: c.end - from > c.step ? toGain / (c.end - from) * 100 : c.avg };
}
