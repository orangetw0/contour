// Seeded random numbers and value noise. The scenery is built from these, so the same seed gives the same world.
let seed = 7;
export const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
export function ridged(x, y, o = 4) {       // sharp crests and gullies, for mountains
  let s = 0, a = 0.5, f = 1, prev = 1;
  for (let i = 0; i < o; i++) { let n = 1 - Math.abs(2 * vnoise(x * f, y * f) - 1); n *= n; s += n * a * prev; prev = n; f *= 2.1; a *= 0.5; }
  return s;
}
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
