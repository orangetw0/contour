/* How fast a rider will take each metre of a course: slow enough for the bend they are in, and slow enough to
   brake in time for the bends ahead. Works from the road's shape alone.
   opts.lateral: sideways grip the rider will use, m/s² (4 is a confident rider on a dry road).
   opts.decel:   how hard they brake, m/s².  opts.max: top speed on a straight, m/s. */
export function buildSpeedLimit(line, { lateral = 4, decel = 3, max = 27.8, window = 5, turnround = null } = {}) {
  const { N, T, ds, closed } = line, nb = i => closed ? (i + N) % N : Math.min(N - 1, Math.max(0, i));
  // how sharply the road turns at each sample (1/m), from the change of heading, averaged over a few samples
  const raw = new Float32Array(N), kappa = new Float32Array(N), v = new Float32Array(N), back = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = T[nb(i - 1)], b = T[nb(i + 1)];
    const la = Math.hypot(a.x, a.z) || 1, lb = Math.hypot(b.x, b.z) || 1;
    raw[i] = Math.abs((a.x * b.z - a.z * b.x) / (la * lb)) / (2 * ds);
  }
  for (let i = 0; i < N; i++) {
    let s = 0; for (let k = -window; k <= window; k++) s += raw[nb(i + k)];
    kappa[i] = s / (2 * window + 1);
    v[i] = back[i] = Math.min(max, Math.sqrt(lateral / Math.max(kappa[i], 1e-6)));
  }
  // an open road ends in a turning loop: riders go round its island at the speed that bend allows, and slow for it in good time
  const round = turnround ?? (closed ? max : Math.sqrt(lateral * (line.turn.radius + 1.75)));
  if (!closed) { v[N - 1] = Math.min(v[N - 1], round); back[0] = Math.min(back[0], round); }
  // walk backwards (twice round a loop): never be going faster than you can brake from before the next bend
  for (let pass = 0; pass < (closed ? 2 : 1); pass++) for (let i = closed ? N - 1 : N - 2; i >= 0; i--) {
    v[i] = Math.min(v[i], Math.sqrt(v[nb(i + 1)] ** 2 + 2 * decel * ds));
  }
  // and the same for someone riding the course the other way
  for (let pass = 0; pass < (closed ? 2 : 1); pass++) for (let i = closed ? 0 : 1; i < N; i++) {
    back[i] = Math.min(back[i], Math.sqrt(back[nb(i - 1)] ** 2 + 2 * decel * ds));
  }
  const at = (s, dir = 1) => {
    if (!closed && (s < 0 || s > line.LEN)) return round;
    const a = dir < 0 ? back : v, f = Math.min(line.wrap(s) / ds, closed ? N : N - 1 - 1e-9), i = Math.floor(f) % N, k = f - Math.floor(f);
    return a[i] + (a[nb(i + 1)] - a[i]) * k;
  };
  return { at, v, back, kappa };
}
