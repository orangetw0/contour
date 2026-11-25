/* Road bikes, built in code. Two original designs: a lightweight climbing bike with slim round tubes and shallow
   rims, and an aero bike with deep foil-section tubes, dropped seatstays and deep rims.
   Local frame: +Z forward, +Y up, +X the rider's left (so the drivetrain is on -X); the origin is on the ground
   under the bottom bracket. Sizes are in metres, for about a 56 cm frame at size 1. */
import * as THREE from 'three';

const V3 = THREE.Vector3, X = new V3(1, 0, 0);

/* The bike's measurements for a frame size. size 1 fits a rider about 1.80 m tall; the frame's contact points
   (saddle, bars) scale with it while the wheels and cranks stay the size they are. */
export function makeGeo(size = 1) {
  const k = Math.min(1.12, Math.max(0.84, size)), bbY = 0.27, at = (y, z) => new V3(0, bbY + (y - bbY) * k, z * k);
  const g = {
    size: k, wheelR: 0.335, rearZ: -0.41, frontZ: 0.585 + (k - 1) * 0.28, bbY, crank: 0.1725, pedalX: 0.125,
    seatTop: at(0.77, -0.148), saddle: at(0.985, -0.215), headTop: at(0.835, 0.40), headBottom: at(0.695, 0.443),
    bar: at(0.9, 0.47), barHalf: 0.20 * (0.6 + 0.4 * k),
  };
  // the brake hoods: where they leave the bar, and the top of the body where the hand rests
  g.hoodBase = side => new V3(side * g.barHalf, g.bar.y - 0.004, g.bar.z + 0.078);
  g.hoodRest = side => new V3(side * g.barHalf, g.bar.y + 0.024, g.bar.z + 0.118);
  // where the rider touches the bike, in the bike's frame. side: +1 left, -1 right.
  // the middle of the hood's body, which the hand closes round
  g.hoodGrip = side => g.hoodBase(side).add(g.hoodRest(side)).multiplyScalar(0.5).add(new V3(0, -0.002, -0.01));
  // the hip joints sit above the wide rear part of the saddle, where the sit bones rest
  g.hipPoint = () => new V3(0, g.saddle.y + 0.088 * k, g.saddle.z - 0.012 * k);
  g.hoodPoint = g.hoodGrip;
  g.pedalPoint = (side, crankAngle, out = new V3()) => {          // the right crank leads; the left is half a turn behind
    const a = crankAngle + (side > 0 ? Math.PI : 0);
    return out.set(side * g.pedalX, g.bbY + g.crank * Math.cos(a), g.crank * Math.sin(a));
  };
  return g;
}
export const GEO = makeGeo(1);

export const BIKE_STYLES = Object.freeze({ climbing: 'climbing', allround: 'climbing', gravel: 'climbing', aero: 'aero', tt: 'aero' });

/* ---------- building blocks ---------- */
// a round tube from a to b; r2 is the radius at b if it tapers
function tube(a, b, r, mat, r2 = r, seg = 12) {
  const d = new V3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  return m;
}
// a foil-section tube: half-width w across the bike, half-depth d along its plane (d2: depth at b if it tapers)
function foil(a, b, w, d, mat, d2 = d) {
  const dir = new V3().subVectors(b, a), len = dir.length(); dir.normalize();
  const geo = new THREE.CylinderGeometry(1, 1, len, 16), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {                           // a rounded nose and a sharper tail
    const t = p.getY(i) / len + 0.5, depth = d + (d2 - d) * t, z = p.getZ(i);
    p.setXYZ(i, p.getX(i) * w * (z < 0 ? 1 - 0.55 * z * z : 1), p.getY(i), z * depth * (z < 0 ? 1.25 : 0.85));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat), xl = X.clone().addScaledVector(dir, -dir.x).normalize(), zl = new V3().crossVectors(xl, dir);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xl, dir, zl));
  m.position.copy(a).addScaledVector(dir, len / 2);
  return m;
}
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
// a disc or ring facing along X
function disc(r, w, mat, x = 0, inner = 0, seg = 40) {
  const geo = inner ? new THREE.RingGeometry(inner, r, seg) : new THREE.CylinderGeometry(r, r, w, seg);
  if (inner) geo.rotateY(Math.PI / 2); else geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat); m.position.x = x; return m;
}

function wheel(mats, R, depth, rear, accent) {
  const g = new THREE.Group(), bead = R - 0.027, inner = bead - depth, hubW = rear ? 0.065 : 0.05;
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(R - 0.0135, 0.0135, 10, 56), mats.tyre); tyre.rotation.y = Math.PI / 2; g.add(tyre);
  // the rim: a V section turned round the axle
  const rim = new THREE.Mesh(new THREE.LatheGeometry([[bead, 0.0125], [inner + 0.004, 0.006], [inner, 0], [inner + 0.004, -0.006], [bead, -0.0125]].map(p => new THREE.Vector2(p[0], p[1])), 56), mats.rim);
  rim.rotation.z = Math.PI / 2; g.add(rim);
  if (depth > 0.04) for (const s of [-1, 1]) {                  // a thin painted ring on each side of a deep rim
    const ring = disc(bead - depth * 0.3, 0, accent, s * 0.0102, bead - depth * 0.3 - 0.004, 56); ring.material = accent; g.add(ring);
  }
  g.add(tube(new V3(-hubW, 0, 0), new V3(hubW, 0, 0), 0.016, mats.dark), disc(0.027, 0.006, mats.dark, hubW - 0.012), disc(0.027, 0.006, mats.dark, -hubW + 0.012));
  const n = rear ? 24 : 20;
  for (let i = 0; i < n; i++) {                                // spokes, laced across to alternate flanges
    const a = i / n * Math.PI * 2, s = i % 2 ? 1 : -1, b = a + s * 0.5;
    g.add(tube(new V3(s * (hubW - 0.012), Math.cos(b) * 0.026, Math.sin(b) * 0.026), new V3(0, Math.cos(a) * inner, Math.sin(a) * inner), 0.0011, mats.spoke, 0.0011, 5));
  }
  const rotor = disc(0.08, 0, mats.metal, hubW - 0.004, 0.052, 36); rotor.material = mats.rotor; g.add(rotor);          // disc brake rotor, on the left
  g.add(tube(new V3(0, inner - 0.03, 0), new V3(0, inner + 0.004, 0), 0.0028, mats.metal, 0.0028, 6));              // valve
  return g;
}

// a saddle: a row of cross-sections from the wide rear to the narrow nose
function saddle(mat) {
  const stations = [[-0.135, 0.062, 0.004], [-0.10, 0.07, 0.006], [-0.04, 0.058, 0.0], [0.03, 0.034, -0.002], [0.09, 0.022, 0.0], [0.135, 0.016, -0.004]], ring = 10, pos = [], idx = [];
  for (const [z, hw, lift] of stations) for (let k = 0; k < ring; k++) {
    const a = k / ring * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(hw * Math.sign(c) * Math.abs(c) ** 0.6, lift + (s > 0 ? 0.011 * s ** 0.5 : 0.013 * s), z);
  }
  for (let i = 0; i < stations.length - 1; i++) for (let k = 0; k < ring; k++) { const a = i * ring + k, b = i * ring + (k + 1) % ring; idx.push(a, a + ring, b, b, a + ring, b + ring); }
  for (const [end, flip] of [[0, false], [stations.length - 1, true]]) for (let k = 1; k < ring - 1; k++) { const o = end * ring; idx.push(o, flip ? o + k : o + k + 1, flip ? o + k + 1 : o + k); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/* frame: paint colour. accent: second colour. style: 'climbing' or 'aero'. geo: measurements from makeGeo. */
export function createBike({ frame = 0xc2202c, accent = 0x111114, geo = GEO, style = 'climbing' } = {}) {
  const aero = style === 'aero', paint = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.38, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 });
  const mats = {
    frame: paint(frame), second: paint(aero ? 0x121214 : frame), accent: new THREE.MeshStandardMaterial({ color: frame, roughness: 0.4, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55 }), rubber: new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.95 }),
    tape: new THREE.MeshStandardMaterial({ color: aero ? 0x0e0e10 : 0x18181b, roughness: 0.9 }), tyre: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }), spoke: new THREE.MeshStandardMaterial({ color: aero ? 0x1c1c1f : 0xc9ccd2, roughness: 0.35, metalness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc0c4ca, roughness: 0.28, metalness: 0.95 }), rotor: new THREE.MeshStandardMaterial({ color: 0xb6bac0, roughness: 0.3, metalness: 0.95, side: THREE.DoubleSide }),
    chain: new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.45, metalness: 0.9 }), saddle: new THREE.MeshStandardMaterial({ color: 0x0f0f11, roughness: 0.7 }),
    bottle: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.5 }), screen: new THREE.MeshStandardMaterial({ color: 0x1f2a2e, roughness: 0.2, metalness: 0.3 }),
  };
  const g = new THREE.Group(), G = geo, R = G.wheelR, v = (x, y, z) => new V3(x, y, z);
  const bb = v(0, G.bbY, 0), rear = v(0, R, G.rearZ), front = v(0, R, G.frontZ), seatAxis = new V3().subVectors(G.seatTop, bb).normalize(), steerAxis = new V3().subVectors(G.headTop, G.headBottom).normalize();
  const ttEnd = G.headTop.clone().addScaledVector(steerAxis, -0.03), dtEnd = G.headBottom.clone().addScaledVector(steerAxis, 0.035).add(v(0, 0, -0.012)), stayTop = G.seatTop.clone().addScaledVector(seatAxis, aero ? -0.15 : -0.025);

  /* frame */
  if (aero) {
    g.add(foil(bb, dtEnd, 0.019, 0.036, mats.frame), foil(bb, G.seatTop, 0.015, 0.032, mats.frame, 0.026), foil(G.headBottom, G.headTop, 0.02, 0.036, mats.frame),
      foil(G.seatTop.clone().add(v(0, 0.012, 0)), ttEnd, 0.019, 0.017, mats.frame), foil(G.seatTop, G.saddle.clone().addScaledVector(seatAxis, -0.045), 0.0095, 0.022, mats.dark));
  } else {
    g.add(tube(bb, dtEnd, 0.0215, mats.frame, 0.02), tube(bb, G.seatTop, 0.0165, mats.frame, 0.0155), tube(G.headBottom, G.headTop, 0.0245, mats.frame, 0.021),
      tube(G.seatTop.clone().add(v(0, -0.006, 0)), ttEnd, 0.0155, mats.frame, 0.0165), tube(G.seatTop, G.saddle.clone().addScaledVector(seatAxis, -0.045), 0.0136, mats.dark),
      tube(G.seatTop.clone().addScaledVector(seatAxis, -0.012), G.seatTop.clone().addScaledVector(seatAxis, 0.006), 0.0185, mats.dark));           // seat clamp
  }
  g.add(tube(v(-0.036, G.bbY, 0), v(0.036, G.bbY, 0), aero ? 0.026 : 0.023, mats.frame, undefined, 18));                                              // bottom bracket shell
  for (const s of [-1, 1]) {
    const drop = v(s * 0.068, rear.y, rear.z);
    g.add(aero ? foil(v(s * 0.03, G.bbY - 0.004, -0.02), drop, 0.008, 0.016, mats.second, 0.011) : tube(v(s * 0.03, G.bbY, -0.02), drop, 0.0115, mats.frame, 0.008));
    g.add(aero ? foil(v(s * 0.022, stayTop.y, stayTop.z), drop, 0.006, 0.011, mats.second) : tube(v(s * 0.02, stayTop.y, stayTop.z), drop, 0.0075, mats.frame, 0.0065));
    g.add(box(0.008, 0.03, 0.03, mats.dark, s * 0.068, rear.y, rear.z));                                                                           // dropout
  }
  g.add(tube(v(-0.072, rear.y, rear.z), v(0.072, rear.y, rear.z), 0.006, mats.dark), box(0.022, 0.05, 0.03, mats.dark, 0.05, rear.y + 0.075, rear.z + 0.05));   // thru-axle, rear caliper

  /* saddle, bottles */
  const sad = saddle(mats.saddle); sad.position.copy(G.saddle).add(v(0, -0.004, 0.02)); g.add(sad);
  for (const s of [-1, 1]) g.add(tube(G.saddle.clone().add(v(s * 0.022, -0.03, -0.06)), G.saddle.clone().add(v(s * 0.02, -0.028, 0.09)), 0.0035, mats.metal, 0.0035, 6));
  g.add(box(0.05, 0.02, 0.04, mats.dark, 0, G.saddle.y - 0.036, G.saddle.z + 0.005));
  const bottleOn = (from, axis, lean) => {
    const a = from.clone().addScaledVector(lean, 0.05), b = a.clone().addScaledVector(axis, 0.15);
    g.add(tube(a, b, 0.036, mats.bottle, 0.036, 18), tube(b, b.clone().addScaledVector(axis, 0.035), 0.03, mats.bottle, 0.016, 18), tube(b.clone().addScaledVector(axis, 0.035), b.clone().addScaledVector(axis, 0.055), 0.013, mats.dark),
      tube(a.clone().addScaledVector(axis, 0.075), a.clone().addScaledVector(axis, 0.082), 0.0385, mats.dark, 0.0385, 18));                          // cage band
  };
  const dtAxis = new V3().subVectors(dtEnd, bb).normalize();
  bottleOn(bb.clone().addScaledVector(dtAxis, 0.16), dtAxis, v(0, dtAxis.z, -dtAxis.y));
  if (!aero) bottleOn(bb.clone().addScaledVector(seatAxis, 0.14), seatAxis, v(0, -seatAxis.z, seatAxis.y));

  /* steering assembly: fork, front wheel, stem, bars and levers turn together about the head tube */
  const steer = new THREE.Group(); steer.position.copy(G.headBottom); g.add(steer);
  const L = p => p.clone().sub(G.headBottom), crown = G.headBottom.clone().addScaledVector(steerAxis, -0.018);
  steer.add(aero ? foil(L(G.headBottom), L(crown.clone().addScaledVector(steerAxis, -0.02)), 0.03, 0.03, mats.second) : tube(L(G.headBottom), L(crown.clone().addScaledVector(steerAxis, -0.012)), 0.025, mats.frame, 0.03));
  for (const s of [-1, 1]) {
    const top = v(s * 0.034, crown.y - 0.012, crown.z + 0.004), end = v(s * 0.056, front.y, front.z);
    steer.add(aero ? foil(L(top), L(end), 0.009, 0.026, mats.second, 0.014) : tube(L(top), L(end), 0.014, mats.frame, 0.008), box(0.008, 0.028, 0.024, mats.dark, s * 0.056, front.y - G.headBottom.y, front.z - G.headBottom.z));
  }
  steer.add(tube(L(v(-0.06, front.y, front.z)), L(v(0.06, front.y, front.z)), 0.006, mats.dark), box(0.022, 0.05, 0.028, mats.dark, 0.046, front.y + 0.085 - G.headBottom.y, front.z - 0.035 - G.headBottom.z));   // axle, front caliper
  const steerTop = G.headTop.clone().addScaledVector(steerAxis, aero ? 0.012 : 0.03), clamp = G.bar.clone();
  if (aero) steer.add(foil(L(G.headTop), L(steerTop), 0.021, 0.034, mats.second), foil(L(steerTop.clone().add(v(0, 0.006, -0.01))), L(clamp), 0.022, 0.014, mats.dark, 0.012));
  else steer.add(tube(L(G.headTop), L(steerTop), 0.0165, mats.dark), tube(L(steerTop.clone().add(v(0, 0.012, 0))), L(steerTop.clone().add(v(0, -0.022, 0))), 0.0185, mats.dark), tube(L(steerTop), L(clamp), 0.0165, mats.dark, 0.0175), box(0.05, 0.04, 0.012, mats.dark, 0, clamp.y - G.headBottom.y, clamp.z + 0.012 - G.headBottom.z));
  steer.add(box(0.045, 0.012, 0.075, mats.dark, 0, clamp.y + 0.016 - G.headBottom.y, clamp.z + 0.085 - G.headBottom.z), box(0.04, 0.003, 0.062, mats.screen, 0, clamp.y + 0.0235 - G.headBottom.y, clamp.z + 0.085 - G.headBottom.z));   // head unit
  {
    const h = G.barHalf, by = G.bar.y, bz = G.bar.z;
    const side = s => [[s * (h - 0.075), by, bz], [s * (h - 0.014), by, bz + 0.022], [s * h, by - 0.002, bz + 0.075], [s * h, by - 0.03, bz + 0.106], [s * h, by - 0.085, bz + 0.096], [s * (h + 0.002), by - 0.124, bz + 0.046], [s * (h + 0.005), by - 0.13, bz - 0.035]].map(p => L(v(...p)));
    for (const s of [-1, 1]) {
      const pts = side(s);
      steer.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0152, 10), mats.tape));        // taped bends and drops
      steer.add(aero ? foil(L(v(0, by, bz)), pts[0], 0.0085, 0.021, mats.dark) : tube(L(v(0, by, bz)), pts[0], 0.0128, mats.dark));   // tops
      steer.add(tube(pts[6], pts[6].clone().add(v(0, 0, -0.004)), 0.016, mats.dark));                                        // bar-end plug
      // brake hood: a rubber body rising forward off the bar to a peak, and the lever blade hanging in front of the drop
      const base = L(G.hoodBase(s)), rest = L(G.hoodRest(s));
      steer.add(tube(base.clone().add(v(0, 0.004, -0.012)), rest.clone().add(v(0, -0.014, -0.012)), 0.0185, mats.rubber, 0.0175, 14));
      const peak = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 10), mats.rubber); peak.scale.set(0.92, 1.25, 1.05); peak.position.copy(rest).add(v(0, -0.006, 0.004)); steer.add(peak);
      steer.add(foil(rest.clone().add(v(0, -0.02, 0.014)), rest.clone().add(v(s * 0.004, -0.085, 0.022)), 0.0055, 0.011, mats.dark), foil(rest.clone().add(v(s * 0.004, -0.085, 0.022)), rest.clone().add(v(s * 0.008, -0.135, -0.002)), 0.0055, 0.011, mats.dark, 0.008));
    }
  }
  const frontWheel = wheel(mats, R, aero ? 0.055 : 0.026, false, mats.accent); frontWheel.position.copy(L(front)); steer.add(frontWheel);
  const rearWheel = wheel(mats, R, aero ? 0.055 : 0.026, true, mats.accent); rearWheel.position.copy(rear); g.add(rearWheel);

  /* drivetrain */
  const cx = -0.048, cranks = new THREE.Group(); cranks.position.copy(bb); g.add(cranks);
  const big = disc(0.105, 0, mats.dark, cx, 0.078, 52); big.material = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
  const small = disc(0.078, 0, mats.dark, cx + 0.008, 0.06, 40); small.material = big.material; cranks.add(big, small);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.6; cranks.add(foil(v(cx, 0, 0), v(cx, Math.cos(a) * 0.082, Math.sin(a) * 0.082), 0.004, 0.012, mats.dark)); }      // spider
  cranks.add(tube(v(-0.07, 0, 0), v(0.07, 0, 0), 0.012, mats.dark));
  const pedals = [];
  for (const s of [-1, 1]) {                                   // s = -1 is the right crank, which points up at angle 0
    const up = s < 0 ? 1 : -1;
    cranks.add(foil(v(s * 0.066, 0, 0), v(s * 0.076, up * G.crank, 0), 0.007, 0.017, mats.dark, 0.012), tube(v(s * 0.076, up * G.crank, 0), v(s * 0.105, up * G.crank, 0), 0.005, mats.metal));
    const pedal = new THREE.Group(); pedal.position.set(s * G.pedalX, up * G.crank, 0);
    pedal.add(box(0.06, 0.014, 0.05, mats.dark, 0, -0.004, 0.004), box(0.052, 0.008, 0.02, mats.dark, 0, -0.002, -0.03));
    cranks.add(pedal); pedals.push(pedal);
  }
  const cogs = 9;
  for (let i = 0; i < cogs; i++) { const cog = disc(0.056 - i * 0.0036, 0.0022, mats.metal, 0, 0, 28); cog.position.set(-0.022 - i * 0.0042, rear.y, rear.z); g.add(cog); }     // cassette
  // rear derailleur, and a chain run over the big ring and a middle cog
  const chainX = cx, j1 = v(chainX, rear.y - 0.075, rear.z + 0.012), j2 = v(chainX, rear.y - 0.15, rear.z + 0.04);
  g.add(box(0.02, 0.05, 0.03, mats.dark, chainX - 0.012, rear.y - 0.04, rear.z + 0.005), disc(0.021, 0.004, mats.dark, 0, 0, 14).translateX(chainX).translateY(j1.y).translateZ(j1.z), disc(0.021, 0.004, mats.dark, 0, 0, 14).translateX(chainX).translateY(j2.y).translateZ(j2.z),
    box(0.003, 0.085, 0.018, mats.dark, chainX - 0.006, (j1.y + j2.y) / 2, (j1.z + j2.z) / 2), box(0.022, 0.03, 0.03, mats.dark, cx + 0.004, G.bbY + 0.125, -0.03));
  const link = (a, b) => { const m = tube(a, b, 0.0032, mats.chain, 0.0032, 5); m.scale.x = 1.8; return m; };
  g.add(link(v(chainX, G.bbY + 0.105, 0), v(chainX, rear.y + 0.042, rear.z)), link(v(chainX, G.bbY - 0.105, 0), v(chainX, j2.y - 0.021, j2.z)), link(v(chainX, j2.y, j2.z - 0.021), v(chainX, j1.y, j1.z + 0.021)), link(v(chainX, j1.y, j1.z - 0.021), v(chainX, rear.y - 0.042, rear.z)));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  let roll = 0;
  return {
    object: g, mats, style,
    // distance: metres rolled since last call; crankAngle: radians, 0 with the right pedal up; steer: radians
    update(distance, crankAngle, steerAngle = 0) {
      roll += distance / R;
      frontWheel.rotation.x = rearWheel.rotation.x = roll;
      cranks.rotation.x = crankAngle;
      for (const p of pedals) p.rotation.x = -crankAngle;                 // pedals stay level
      steer.quaternion.setFromAxisAngle(steerAxis, steerAngle);
    },
  };
}
