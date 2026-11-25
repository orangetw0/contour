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

/* The road as a line sampled every 1.5 m: a closed loop, or an open road with two ends.
   P: points, T: tangents (T.y is the slope), R: unit vectors to the rider's right.
   at(s, pose) fills a pose for a distance s along the road; nearRoad(x, z) finds the closest road point.
   wrap(s) keeps a distance on the road: round the loop, or stopped at the ends. */
export function buildLine(ctrl, { closed = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(ctrl, closed, 'centripetal');
  curve.arcLengthDivisions = Math.max(4000, ctrl.length * 12);
  const LEN = curve.getLength();
  const N = Math.max(4, Math.floor(LEN / 1.5) + (closed ? 0 : 1)), steps = closed ? N : N - 1, ds = LEN / steps;
  const P = closed ? curve.getSpacedPoints(N).slice(0, N) : curve.getSpacedPoints(N - 1);
  const nb = i => closed ? (i + N) % N : Math.min(N - 1, Math.max(0, i));
  const T = P.map((_, i) => new V3().subVectors(P[nb(i + 1)], P[nb(i - 1)]).normalize());
  const R = T.map(t => new V3(-t.z, 0, t.x).normalize());
  const wrap = s => closed ? ((s % LEN) + LEN) % LEN : Math.min(LEN, Math.max(0, s));

  function at(s, out) {
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
  const near = { d: 0, y: 0, i: 0, side: 0 };
  function nearRoad(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = 1e12, bi = -1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = grid.get(gkey(cx + dx, cz + dz));
      if (!arr) continue;
      for (const i of arr) { const ex = x - P[i].x, ez = z - P[i].z, d2 = ex * ex + ez * ez; if (d2 < best) { best = d2; bi = i; } }
    }
    if (bi < 0) return null;
    const ex = x - P[bi].x, ez = z - P[bi].z;
    near.d = Math.sqrt(best); near.i = bi;
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
  return { LEN, N, P, T, R, ds, closed, at, wrap, apart, nearRoad, nearestS, scratch: mkPose() };
}
