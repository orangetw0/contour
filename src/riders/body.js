/* Body shape. The character models are one athletic, heavily muscled build each. Here a rider's height and weight
   turn that into an ordinary cyclist's body: slimmer arms and shoulders, a chest and waist that follow body mass,
   and softened muscle definition. Pure maths on arrays, so it can be tested without a browser.
   All positions are in the model's own rest pose (a T-pose, +Y up, +Z forward). */

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* How a rider is built, from sex, weight (kg) and height (m). `build` runs from about -0.5 (very light for their
   height) through 0 (lean, BMI 22) to 1 (BMI 30) and beyond. Every number is a scale on the model's own girth. */
export function shapeOf({ sex = 'male', kg = 72, heightM = 1.78 }) {
  const bmi = kg / (heightM * heightM), b = clamp((bmi - 22) / 8, -0.5, 1.6), f = sex === 'female';
  return {
    build: b, bmi,
    shoulders: f ? 0.95 + 0.04 * b : 0.84 + 0.06 * b,               // how far out the arms start
    girth: {
      upperarm: f ? 0.88 + 0.16 * b : 0.70 + 0.16 * b, lowerarm: f ? 0.92 + 0.10 * b : 0.80 + 0.10 * b,
      thigh: f ? 0.95 + 0.18 * b : 0.90 + 0.18 * b, calf: f ? 0.96 + 0.10 * b : 0.90 + 0.10 * b,
      neck_01: f ? 0.95 + 0.10 * b : 0.80 + 0.12 * b,
    },
    // the trunk: [width, depth in front, depth behind]. Weight goes on at the waist first, and mostly in front.
    trunk: {
      spine_03: f ? [0.96 + 0.08 * b, 0.94 + 0.10 * b, 0.96 + 0.06 * b] : [0.84 + 0.09 * b, 0.78 + 0.12 * b, 0.86 + 0.08 * b],
      spine_02: f ? [0.97 + 0.14 * b, 0.96 + 0.26 * b, 0.97 + 0.08 * b] : [0.90 + 0.15 * b, 0.90 + 0.30 * b, 0.90 + 0.08 * b],
      spine_01: f ? [1.00 + 0.20 * b, 1.00 + 0.42 * b, 1.00 + 0.10 * b] : [1.00 + 0.22 * b, 1.02 + 0.48 * b, 0.98 + 0.10 * b],
      pelvis: f ? [1.00 + 0.16 * b, 1.00 + 0.30 * b, 1.00 + 0.14 * b] : [0.98 + 0.16 * b, 1.00 + 0.32 * b, 0.97 + 0.12 * b],
    },
    smooth: f ? 0.45 : 0.75,                                         // how much muscle definition to iron out
  };
}

const CHILD = { upperarm: 'lowerarm', lowerarm: 'hand', thigh: 'calf', calf: 'foot', neck_01: 'Head' };
const base = n => n.replace(/_[lr]$/, ''), side = n => (/_[lr]$/.exec(n) || [''])[0];

/* Which vertices sit at the same place (the mesh is split along texture seams) and who their neighbours are.
   Worked out once per model. */
export function buildTopology(pos, index) {
  const n = pos.length / 3, key = new Map(), group = new Int32Array(n);
  let groups = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos[i * 3] * 1e4) + ',' + Math.round(pos[i * 3 + 1] * 1e4) + ',' + Math.round(pos[i * 3 + 2] * 1e4);
    let g = key.get(k); if (g === undefined) { g = groups++; key.set(k, g); }
    group[i] = g;
  }
  const sets = Array.from({ length: groups }, () => new Set());
  for (let t = 0; t < index.length; t += 3) {
    const a = group[index[t]], b = group[index[t + 1]], c = group[index[t + 2]];
    sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b);
  }
  return { group, groups, neighbours: sets.map(s => Int32Array.from(s)) };
}

/* A reshaped copy of the model's rest positions.
   pos: Float32Array of xyz. skinIndex/skinWeight: 4 per vertex. names: bone name per skin index.
   joints: { boneName: [x, y, z] } rest positions. topology: from buildTopology. keep: per vertex, 0 to smooth fully,
   1 to leave alone (faces, hands and feet keep their detail). */
export function reshape(pos, skinIndex, skinWeight, names, joints, shape, topology, keep) {
  const n = pos.length / 3, out = new Float32Array(pos.length);
  const plan = names.map(name => {
    const b = base(name), s = side(name);
    if (shape.trunk[b]) return { kind: 'trunk', a: joints[name], k: shape.trunk[b] };
    if (shape.girth[b] && CHILD[b]) {
      const a = joints[name], c = joints[CHILD[b] + (b === 'neck_01' ? '' : s)];
      const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], l = Math.hypot(...u);
      return { kind: 'limb', a, u: u.map(x => x / l), k: shape.girth[b] };
    }
    return null;
  });
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let ox = 0, oy = 0, oz = 0, wsum = 0;
    for (let j = 0; j < 4; j++) {
      const w = skinWeight[i * 4 + j]; if (!w) continue;
      const p = plan[skinIndex[i * 4 + j]]; wsum += w;
      if (!p) { ox += w * x; oy += w * y; oz += w * z; continue; }
      const dx = x - p.a[0], dy = y - p.a[1], dz = z - p.a[2];
      if (p.kind === 'trunk') {                                    // scale width and depth about the spine, which is upright
        ox += w * (p.a[0] + dx * p.k[0]); oy += w * y; oz += w * (p.a[2] + dz * (dz > 0 ? p.k[1] : p.k[2]));
      } else {                                                     // scale girth about the limb's own line
        const t = dx * p.u[0] + dy * p.u[1] + dz * p.u[2];
        ox += w * (p.a[0] + p.u[0] * t + (dx - p.u[0] * t) * p.k); oy += w * (p.a[1] + p.u[1] * t + (dy - p.u[1] * t) * p.k); oz += w * (p.a[2] + p.u[2] * t + (dz - p.u[2] * t) * p.k);
      }
    }
    out[i * 3] = ox / wsum; out[i * 3 + 1] = oy / wsum; out[i * 3 + 2] = oz / wsum;
  }
  // iron out muscle definition: a few rounds of pulling each point toward the middle of its neighbours
  const { group, groups, neighbours } = topology, g = new Float32Array(groups * 3), h = new Float32Array(groups * 3), hold = new Float32Array(groups).fill(1);
  for (let i = 0; i < n; i++) { const k = group[i]; g[k * 3] = out[i * 3]; g[k * 3 + 1] = out[i * 3 + 1]; g[k * 3 + 2] = out[i * 3 + 2]; hold[k] = Math.min(hold[k], keep ? keep[i] : 0); }
  for (let pass = 0; pass < 7; pass++) {
    for (let k = 0; k < groups; k++) {
      const nb = neighbours[k], amt = shape.smooth * (1 - hold[k]);
      if (!nb.length || amt <= 0) { h[k * 3] = g[k * 3]; h[k * 3 + 1] = g[k * 3 + 1]; h[k * 3 + 2] = g[k * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (const m of nb) { sx += g[m * 3]; sy += g[m * 3 + 1]; sz += g[m * 3 + 2]; }
      h[k * 3] = g[k * 3] + (sx / nb.length - g[k * 3]) * amt; h[k * 3 + 1] = g[k * 3 + 1] + (sy / nb.length - g[k * 3 + 1]) * amt; h[k * 3 + 2] = g[k * 3 + 2] + (sz / nb.length - g[k * 3 + 2]) * amt;
    }
    g.set(h);
  }
  for (let i = 0; i < n; i++) { const k = group[i]; out[i * 3] = g[k * 3]; out[i * 3 + 1] = g[k * 3 + 1]; out[i * 3 + 2] = g[k * 3 + 2]; }
  return out;
}
