/* A road bike, built from tubes. Local frame: +Z forward, +Y up, +X the rider's left; the origin is on the ground
   under the bottom bracket. Sizes are in metres, for about a 56 cm road frame at size 1. */
import * as THREE from 'three';

const V3 = THREE.Vector3;

/* The bike's measurements for a frame size. size 1 fits a rider about 1.80 m tall; the frame's contact points
   (saddle, bars) scale with it while the wheels and cranks stay the size they are. */
export function makeGeo(size = 1) {
  const k = Math.min(1.12, Math.max(0.84, size)), bbY = 0.27, at = (y, z) => new V3(0, bbY + (y - bbY) * k, z * k);
  const g = {
    size: k, wheelR: 0.335, rearZ: -0.41, frontZ: 0.585 + (k - 1) * 0.28, bbY, crank: 0.1725, pedalX: 0.125,
    seatTop: at(0.77, -0.148), saddle: at(0.985, -0.215), headTop: at(0.835, 0.40), headBottom: at(0.695, 0.443),
    bar: at(0.885, 0.495), barHalf: 0.20 * (0.6 + 0.4 * k), hoodZ: 0.605 * k, hoodY: bbY + (0.915 - bbY) * k, dropY: bbY + (0.76 - bbY) * k,
  };
  // where the rider touches the bike, in the bike's frame. side: +1 left, -1 right.
  g.hipPoint = () => new V3(0, g.saddle.y + 0.10 * k, g.saddle.z + 0.05 * k);
  g.hoodPoint = side => new V3(side * g.barHalf, g.hoodY + 0.02, g.hoodZ - 0.045);
  g.pedalPoint = (side, crankAngle, out = new V3()) => {          // the right crank leads; the left is half a turn behind
    const a = crankAngle + (side > 0 ? Math.PI : 0);
    return out.set(side * g.pedalX, g.bbY + g.crank * Math.cos(a), g.crank * Math.sin(a));
  };
  return g;
}
export const GEO = makeGeo(1);

function tube(a, b, r, mat, r2 = r) {
  const d = new V3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, d.length(), 10), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  return m;
}

function wheel(mats, R) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(R - 0.013, 0.013, 8, 40), mats.tyre);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.036, 0.014, 6, 40), mats.rim);
  tyre.rotation.y = rim.rotation.y = Math.PI / 2;
  g.add(tyre, rim, tube(new V3(-0.05, 0, 0), new V3(0.05, 0, 0), 0.018, mats.metal));
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, side = i % 2 ? 0.03 : -0.03;
    g.add(tube(new V3(side, 0, 0), new V3(0, Math.cos(a) * (R - 0.04), Math.sin(a) * (R - 0.04)), 0.0016, mats.metal));
  }
  return g;
}

export function createBike({ frame = 0xc2202c, accent = 0x111114, geo = GEO } = {}) {
  const mats = {
    frame: new THREE.MeshStandardMaterial({ color: frame, roughness: 0.35, metalness: 0.2 }),
    dark: new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.4, metalness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 }),
  };
  const g = new THREE.Group(), G = geo;
  const bb = new V3(0, G.bbY, 0), rear = new V3(0, G.wheelR, G.rearZ), front = new V3(0, G.wheelR, G.frontZ);
  // frame
  g.add(tube(bb, G.seatTop, 0.017, mats.frame), tube(G.seatTop, G.headTop.clone().add(new V3(0, -0.02, 0)), 0.016, mats.frame),
    tube(bb, G.headBottom.clone().add(new V3(0, 0.03, -0.01)), 0.021, mats.frame), tube(G.headBottom, G.headTop, 0.022, mats.frame),
    tube(G.seatTop, G.saddle.clone().add(new V3(0, -0.03, 0)), 0.0135, mats.dark), tube(new V3(-0.035, G.bbY, 0), new V3(0.035, G.bbY, 0), 0.022, mats.frame));
  for (const s of [-1, 1]) {
    g.add(tube(new V3(s * 0.03, G.bbY, 0), new V3(s * 0.065, rear.y, rear.z), 0.011, mats.frame),
      tube(new V3(s * 0.02, G.seatTop.y - 0.03, G.seatTop.z), new V3(s * 0.065, rear.y, rear.z), 0.008, mats.frame));
  }
  const saddle = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.19, 4, 10), mats.dark);
  saddle.rotation.x = Math.PI / 2; saddle.scale.set(1.5, 1, 0.45); saddle.position.copy(G.saddle).add(new V3(0, -0.01, 0.01)); g.add(saddle);

  // steering assembly: fork, front wheel, stem and bars turn together about the head tube
  const steerAxis = new V3().subVectors(G.headTop, G.headBottom).normalize();
  const steer = new THREE.Group(); steer.position.copy(G.headBottom); g.add(steer);
  const L = p => p.clone().sub(G.headBottom);
  for (const s of [-1, 1]) steer.add(tube(L(new V3(s * 0.02, G.headBottom.y, G.headBottom.z)), L(new V3(s * 0.055, front.y, front.z)), 0.012, mats.frame, 0.009));
  steer.add(tube(L(G.headTop), L(G.headTop.clone().addScaledVector(steerAxis, 0.035)), 0.016, mats.dark), tube(L(G.headTop.clone().addScaledVector(steerAxis, 0.03)), L(G.bar), 0.015, mats.dark));
  {
    const h = G.barHalf, half = [[h, G.dropY, G.bar.z - 0.02], [h + 0.003, G.dropY - 0.005, G.bar.z + 0.05], [h + 0.003, G.dropY + 0.07, G.hoodZ + 0.0], [h, G.hoodY - 0.035, G.hoodZ - 0.02], [h - 0.012, G.bar.y, G.bar.z + 0.02], [h - 0.06, G.bar.y, G.bar.z], [0, G.bar.y, G.bar.z]];
    const pts = [...half, ...half.slice(0, -1).reverse().map(p => [-p[0], p[1], p[2]])].map(p => L(new V3(...p)));
    steer.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.0125, 8), mats.dark));
    for (const s of [-1, 1]) {
      const hood = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.07, 4, 8), mats.dark);
      hood.position.copy(L(new V3(s * h, G.hoodY, G.hoodZ))); hood.rotation.x = 0.9; steer.add(hood);
    }
  }
  const frontWheel = wheel(mats, G.wheelR); frontWheel.position.copy(L(front)); steer.add(frontWheel);
  const rearWheel = wheel(mats, G.wheelR); rearWheel.position.copy(rear); g.add(rearWheel);

  // cranks, chainring and pedals
  const cranks = new THREE.Group(); cranks.position.copy(bb); g.add(cranks);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.004, 28), mats.rim); ring.rotation.z = Math.PI / 2; ring.position.x = -0.05; cranks.add(ring);
  const pedals = [];
  for (const s of [-1, 1]) {                                   // s = -1 is the right crank, which points up at angle 0
    const dirY = s < 0 ? 1 : -1;
    cranks.add(tube(new V3(s * 0.06, 0, 0), new V3(s * 0.075, dirY * G.crank, 0), 0.011, mats.dark));
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.016, 0.07), mats.dark);
    pedal.position.set(s * G.pedalX, dirY * G.crank, 0); cranks.add(pedal); pedals.push(pedal);
  }
  const cog = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), mats.metal); cog.rotation.z = Math.PI / 2; cog.position.set(-0.045, rear.y, rear.z); g.add(cog);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  let roll = 0;
  return {
    object: g, mats,
    // distance: metres rolled since last call; crankAngle: radians, 0 with the right pedal up; steer: radians
    update(distance, crankAngle, steerAngle = 0) {
      roll += distance / G.wheelR;
      frontWheel.rotation.x = rearWheel.rotation.x = roll;
      cranks.rotation.x = crankAngle;
      for (const p of pedals) p.rotation.x = -crankAngle;                 // pedals stay level
      steer.quaternion.setFromAxisAngle(steerAxis, steerAngle);
    },
  };
}
