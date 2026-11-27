import * as THREE from 'three';

const V3 = THREE.Vector3;

export const mkPose = () => ({ p: new V3(), t: new V3(), r: new V3() });

// The invented valley: a wobbly closed ring of control points.
export function valleyControl() {
  const ctrl = [];
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2;
    const r = 430 + 110 * Math.sin(a * 3 + 0.6) + 60 * Math.sin(a * 5 + 2.1);
    ctrl.push(new V3(Math.cos(a) * r, 40 + 16 * Math.sin(a * 2 + 1) + 4 * Math.sin(a * 5), Math.sin(a) * r));
  }
  return ctrl;
}

/* The turning loop at each end of an open road, as a path a rider follows: straight on for `stem` metres, a bend of
   radius `ease` toward their own side of the road, then round the island (radius `radius`) the other way and back
   down the same bend to the road, now heading home. Worked out in a flat frame: x straight on from the road's end,
   y toward the side riders keep to. local(u, out) fills out.x, out.y and out.a (heading, radians from x toward y)
   for u metres round the loop; `len` is the whole way round and `centre` is how far beyond the end the island sits. */
export function turnShape({ stem = 6, ease = 12, radius = 5 } = {}) {
  const phi = Math.acos(ease / (ease + radius)), bend = ease * phi, len = 2 * (stem + bend) + radius * (Math.PI + 2 * phi), half = len / 2;
  const centre = stem + (ease + radius) * Math.sin(phi);
  function local(u, out) {
    const v = Math.min(half, u > half ? len - u : Math.max(0, u));          // the way back mirrors the way out
    if (v <= stem) { out.x = v; out.y = 0; out.a = 0; }
    else if (v <= stem + bend) { const a = (v - stem) / ease; out.x = stem + ease * Math.sin(a); out.y = ease * (1 - Math.cos(a)); out.a = a; }
    else { const a = (v - stem - bend) / radius, b = Math.PI / 2 + phi - a; out.x = centre + radius * Math.cos(b); out.y = radius * Math.sin(b); out.a = phi - a; }
    if (u > half) { out.y = -out.y; out.a = Math.PI - out.a; }
    return out;
  }
  return { stem, ease, radius, phi, len, half, centre, local };
}

/* The road as a line sampled every 1.5 m: a closed loop, or an open road with two ends.
   P: points, T: tangents (T.y is the slope), R: unit vectors to the rider's right.
   at(s, pose) fills a pose for a distance s along the road; nearRoad(x, z) finds the closest road point.
   wrap(s) keeps a distance on the road: round the loop, or stopped at the ends.
   keep: the side of the road riders keep to, +1 right or -1 left.
   An open road has a turning loop beyond each end (`turn`): distances below 0 and above LEN are places on those
   loops, turn.len metres round each. A rider leaves the end, goes round, and arrives back at the same end facing the
   other way, so at(LEN + turn.len) is the road's end again with its tangent and right vector reversed, and
   distances beyond that carry on back down the road (still reversed), which keeps a camera or a look-ahead point
   moving smoothly through the turn. */
export function buildLine(ctrl, { closed = true, keep = -1, loop } = {}) {
  const curve = new THREE.CatmullRomCurve3(ctrl, closed, 'centripetal');
  curve.arcLengthDivisions = Math.max(4000, ctrl.length * 12);
  const LEN = curve.getLength();
  const N = Math.max(4, Math.floor(LEN / 1.5) + (closed ? 0 : 1)), steps = closed ? N : N - 1, ds = LEN / steps;
  const P = closed ? curve.getSpacedPoints(N).slice(0, N) : curve.getSpacedPoints(N - 1);
  const nb = i => closed ? (i + N) % N : Math.min(N - 1, Math.max(0, i));
  const T = P.map((_, i) => new V3().subVectors(P[nb(i + 1)], P[nb(i - 1)]).normalize());
  const R = T.map(t => new V3(-t.z, 0, t.x).normalize());
  // the turning loops: for each end, where it is, which way is straight on, and which way is the riders' own side
  const shape = closed ? null : turnShape(loop), spot = { x: 0, y: 0, a: 0 };
  const ends = closed ? [] : [0, N - 1].map((i, e) => {
    const out = new V3(T[i].x, 0, T[i].z).normalize().multiplyScalar(e ? 1 : -1), side = new V3(-out.z, 0, out.x).multiplyScalar(keep);
    return { i, p: P[i], out, side, c: P[i].clone().addScaledVector(out, shape.centre), pts: [] };
  });
  const turn = closed ? null : { ...shape, keep, ends };
  const wrap = s => closed ? ((s % LEN) + LEN) % LEN : Math.min(LEN + turn.len, Math.max(-turn.len, s));
  // a place u metres round the loop at one end; `way` is +1 when distance along the road grows as the rider goes round
  function onLoop(end, u, way, out) {
    turn.local(u, spot);
    const c = Math.cos(spot.a) * way, n = Math.sin(spot.a) * way;
    out.p.copy(end.p).addScaledVector(end.out, spot.x).addScaledVector(end.side, spot.y);
    out.t.set(end.out.x * c + end.side.x * n, 0, end.out.z * c + end.side.z * n);
    out.r.set(-out.t.z, 0, out.t.x);
    return out;
  }
  for (const end of ends) for (let u = 0, pose = mkPose(); u <= turn.len; u += 1.5) end.pts.push(onLoop(end, u, 1, pose).p.clone());

  function at(s, out) {
    if (!closed && (s < 0 || s > LEN)) {
      const e = s < 0 ? 0 : 1, u = e ? s - LEN : -s;
      if (u <= turn.len) return onLoop(ends[e], u, e ? 1 : -1, out);
      at(e ? Math.max(0, LEN - (u - turn.len)) : Math.min(LEN, u - turn.len), out);      // round and heading back: the road again, reversed
      out.t.negate(); out.r.negate();
      return out;
    }
    const f = Math.min(wrap(s) / ds, closed ? N : N - 1 - 1e-9);
    const i = Math.floor(f) % N, j = nb(i + 1), k = f - Math.floor(f);
    out.p.lerpVectors(P[i], P[j], k);
    out.t.lerpVectors(T[i], T[j], k).normalize();
    out.r.set(-out.t.z, 0, out.t.x).normalize();
    return out;
  }
  // Spatial hash so "how far is this point from the road" is cheap.
  const CELL = 64, grid = new Map(), gkey = (cx, cz) => cx * 4096 + cz;
  P.forEach((p, i) => {
    const k = gkey(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    (grid.get(k) || grid.set(k, []).get(k)).push(i);
  });
  // the turning loops count as road too: their points go in after the road's own, each remembering its end
  const extra = [];
  for (const end of ends) for (const p of end.pts) {
    const k = gkey(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    (grid.get(k) || grid.set(k, []).get(k)).push(N + extra.length); extra.push({ p, end });
  }
  const near = { d: 0, y: 0, i: 0, side: 0 };
  function nearRoad(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = 1e12, bi = -1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = grid.get(gkey(cx + dx, cz + dz));
      if (!arr) continue;
      for (const i of arr) { const p = i < N ? P[i] : extra[i - N].p, ex = x - p.x, ez = z - p.z, d2 = ex * ex + ez * ez; if (d2 < best) { best = d2; bi = i; } }
    }
    if (bi < 0) return null;
    near.d = Math.sqrt(best);
    if (bi >= N) {                           // on a turning loop: level ground at the height of the road's end
      const { p, end } = extra[bi - N];
      near.i = end.i; near.y = p.y; near.side = (x - end.p.x) * R[end.i].x + (z - end.p.z) * R[end.i].z;
      return near;
    }
    const ex = x - P[bi].x, ez = z - P[bi].z;
    near.i = bi;
    near.y = P[bi].y + T[bi].y * (ex * T[bi].x + ez * T[bi].z);
    near.side = ex * R[bi].x + ez * R[bi].z;
    return near;
  }

  // the road point nearest to (x, z), as a distance along the road; for jumping to a place when checking
  function nearestS(x, z) {
    let b = 0, bd = 1e12;
    for (let i = 0; i < N; i++) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < bd) { bd = d; b = i; } }
    return { s: b * ds, gap: Math.sqrt(bd) };
  }

  // how far apart two places on the road are, the short way round a loop
  const apart = (a, b) => { const d = Math.abs(wrap(a) - wrap(b)); return closed ? Math.min(d, LEN - d) : d; };
  return { LEN, N, P, T, R, ds, closed, keep, turn, at, wrap, apart, nearRoad, nearestS, scratch: mkPose() };
}
