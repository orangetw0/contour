/* Finds the climb ahead of a rider, if there is one worth showing.
   height(d): the road's height d metres ahead. limit: how far the road goes on (metres). threshold: the gradient
   in % that counts as a climb. Returns null, or { start, end, gain, avg, step, heights }: distances in metres
   ahead of the rider, gain in metres, avg in %, and the heights sampled every `step` metres from 0 to past the top. */
export function climbAhead(height, { limit = Infinity, threshold = 3, step = 25, look = 400, max = 15000, minGain = 12 } = {}) {
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
  const gain = h[top] - h[a];
  if (top <= a || gain < minGain) return null;
  return { start: a * step, end: top * step, gain, avg: gain / ((top - a) * step) * 100, step, heights: h.slice(0, Math.min(n, top + 6) + 1) };
}
