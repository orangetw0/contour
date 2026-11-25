/* A rider: a rigged character (Quaternius Universal Base Characters, CC0) dressed in cycling kit and posed on a
   bike. The model is a plain body in a T-pose; here it gets a jersey, bib shorts, socks, shoes and gloves painted
   on by a shader, a helmet and glasses, and a riding position solved each frame: hips on the saddle, hands on the
   hoods, feet following the pedals. Frame: +Z forward, +Y up, +X the rider's left, origin under the bottom bracket. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { worldPos, worldQuat, setWorldQuat, rotateWorld, twoBone, aim, frameRotation } from './ik.js';
import { GEO } from './bike.js';
import { shapeOf, buildTopology, reshape } from './body.js';
import { KITS, dress, limbCoord } from './kit.js';
import { addHeadGear, addShoes } from './gear.js';

export { KITS };

const V3 = THREE.Vector3, X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1);
export const CHARACTERS = Object.freeze({ male: 'Male', female: 'Female' });
// Skin tones, as a lift applied to the model's one (dark) skin texture.
export const SKINS = Object.freeze({ light: { name: 'Light', gain: [2.5, 2.0, 1.8] }, medium: { name: 'Medium', gain: [1.9, 1.55, 1.38] }, tan: { name: 'Tan', gain: [1.4, 1.22, 1.12] }, dark: { name: 'Dark', gain: [1, 1, 1] } });

const loader = new GLTFLoader(), cache = new Map(), topologies = new WeakMap();
export const loadCharacter = kind => {
  if (!cache.has(kind)) cache.set(kind, loader.loadAsync(`assets/riders/${kind === 'female' ? 'female' : 'male'}.gltf`));
  return cache.get(kind);
};

// Measure the head at rest, so the helmet and glasses can be made to fit it.
function measureHead(body, eyesMesh, joint) {
  const eyes = new THREE.Box3().setFromBufferAttribute(eyesMesh.geometry.attributes.position), brow = eyes.max.y + 0.034;
  const pos = body.geometry.attributes.position, hd = body.geometry.attributes.aHead, skull = new THREE.Box3(), p = new V3();
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); if (hd.getX(i) > 0.9 && p.y > brow) skull.expandByPoint(p); }
  return { skull, brow, eyes, neck: joint.Head.y };
}

/* kit: colours. sex, kg, heightM: the rider's build. skin: one of SKINS. geo: the bike's measurements (makeGeo). */
export function createAvatar(gltf, { kit = KITS.red, sex = 'male', kg = 72, heightM = 1.78, skin = 'medium', geo = GEO } = {}) {
  const model = cloneSkinned(gltf.scene), object = new THREE.Group();
  object.add(model); object.updateMatrixWorld(true);
  const bones = {}, rest = {}, joint = {};
  let body = null, eyesMesh = null;
  model.traverse(o => {
    if (o.isBone) { bones[o.name] = o; rest[o.name] = { q: o.quaternion.clone(), p: o.position.clone(), w: worldQuat(o, new THREE.Quaternion()) }; joint[o.name] = worldPos(o, new V3()); }
    if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; if (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count) body = o; if (/eye/i.test(o.material.name)) eyesMesh = o; if (/hair/i.test(o.material.name)) o.visible = false; }      // the eyebrow cards have no cut-out and sit behind the glasses anyway
  });
  // this rider's own body: the shared model reshaped for their height and weight
  const src = body.geometry, shape = shapeOf({ sex, kg, heightM }), names = body.skeleton.bones.map(b => b.name);
  dress(body, joint, kit, (SKINS[skin] || SKINS.medium).gain, shape.girth.thigh);
  if (!topologies.has(src)) topologies.set(src, buildTopology(src.attributes.position.array, src.index.array));
  const keep = new Float32Array(src.attributes.position.count), part = src.attributes.aPart, head = src.attributes.aHead;
  for (let i = 0; i < keep.length; i++) keep[i] = Math.min(1, head.getX(i) * 1.5 + part.getZ(i) * 1.5);
  const jointArrays = Object.fromEntries(Object.entries(joint).map(([k, v]) => [k, v.toArray()]));
  const mine = new THREE.BufferGeometry(); mine.index = src.index;
  for (const k in src.attributes) mine.setAttribute(k, src.attributes[k]);
  mine.setAttribute('position', new THREE.BufferAttribute(reshape(src.attributes.position.array, src.attributes.skinIndex.array, src.attributes.skinWeight.array, names, jointArrays, shape, topologies.get(src), keep), 3));
  {                                                                // hems follow this body, not the model it came from
    const own = part.array.slice(), np = mine.attributes.position, coord = limbCoord(joint), p = new V3();
    for (let i = 0; i < np.count; i++) own[i * 4 + 3] = coord(p.fromBufferAttribute(np, i), own[i * 4], own[i * 4 + 1]);
    mine.setAttribute('aPart', new THREE.BufferAttribute(own, 4));
  }
  mine.boundingSphere = src.boundingSphere; mine.boundingBox = src.boundingBox;
  body.geometry = mine;
  addHeadGear(bones.Head, measureHead(body, eyesMesh || body, joint), kit);
  addShoes(body, bones, names, joint.foot_l.y, kit);
  for (const s of ['_l', '_r']) rest['upperarm' + s].p.multiplyScalar(shape.shoulders);         // narrower or broader shoulders
  // height: the whole rider scales, and everything below works in the scaled size
  const tall = new THREE.Box3().setFromBufferAttribute(src.attributes.position).max.y, scale = heightM / tall;
  model.scale.setScalar(scale);
  for (const n in rest) bones[n].position.copy(rest[n].p);
  object.updateMatrixWorld(true);
  for (const n in bones) worldPos(bones[n], joint[n]);

  const B = bones, spine = [B.pelvis, B.spine_01, B.spine_02, B.spine_03], share = [0.42, 0.2, 0.2, 0.18];
  const armLen = joint.upperarm_l.distanceTo(joint.lowerarm_l) + joint.lowerarm_l.distanceTo(joint.hand_l);
  const ballFromAnkle = new V3().subVectors(joint.ball_l, joint.foot_l), tmp = new V3(), tmp2 = new V3(), q = new THREE.Quaternion(), hips = new V3(), pedal = new V3(), ankle = new V3();
  const hip = geo.hipPoint(), hood = { 1: geo.hoodPoint(1), [-1]: geo.hoodPoint(-1) };

  function torso(lean) {
    for (const n in rest) if (!/^(upperarm|lowerarm|hand|thigh|calf|foot|ball|index|middle|ring|pinky|thumb)/.test(n)) { B[n].quaternion.copy(rest[n].q); B[n].position.copy(rest[n].p); }
    model.updateMatrixWorld(true);
    spine.forEach((b, i) => rotateWorld(b, X, lean * share[i]));
    hips.addVectors(worldPos(B.thigh_l, tmp), worldPos(B.thigh_r, tmp2)).multiplyScalar(0.5);
    B.pelvis.position.add(tmp.subVectors(hip, hips).divideScalar(scale)); B.pelvis.updateMatrixWorld(true);
    rotateWorld(B.neck_01, X, -lean * 0.4); rotateWorld(B.Head, X, -lean * 0.42);       // look up the road
  }
  // lean forward just far enough that the arms reach the hoods with a little bend
  let lo = 0.35, hi = 1.3;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2; torso(mid);
    if (worldPos(B.upperarm_l, tmp).distanceTo(hood[1]) > armLen * 0.97) lo = mid; else hi = mid;
  }
  const lean = (lo + hi) / 2;

  const toeFwd = new V3(), toeUp = new V3(), curl = new V3(), handFwd = new V3(), palm = new V3(), wrist = new V3();
  const handLen = joint.hand_l.distanceTo(joint.middle_01_l), CURL = { index: [0.55, 1.0, 0.6], middle: [0.7, 1.05, 0.6], ring: [0.95, 1.1, 0.6], pinky: [1.0, 1.1, 0.6] };
  /* crankAngle: radians, 0 with the right pedal up. sway: small side-to-side rock of the shoulders (radians). */
  function pose(crankAngle, sway = 0) {
    for (const n in rest) B[n].quaternion.copy(rest[n].q);
    torso(lean);
    if (sway) rotateWorld(B.spine_02, Z, sway);
    for (const side of [1, -1]) {
      const s = side > 0 ? '_l' : '_r';
      // arm and hand: the palm lies on top of the brake hood with the fingers pointing forward and a little down,
      // the first two fingers hooked over the lever and the others wrapped under the hood; the thumb sits inside
      handFwd.set(-side * 0.1, -0.3, 0.95).normalize(); palm.set(-side * 0.5, -0.86, -0.1).addScaledVector(handFwd, 0.3).normalize();
      wrist.copy(hood[side]).addScaledVector(handFwd, -handLen * 0.42).addScaledVector(palm, -0.006);
      twoBone(B['upperarm' + s], B['lowerarm' + s], B['hand' + s], wrist, tmp.set(side * 0.5, -1, -0.3));
      setWorldQuat(B['hand' + s], frameRotation(tmp2.set(side, 0, 0), Y.clone().negate(), handFwd, palm, q).multiply(rest['hand' + s].w));
      curl.crossVectors(handFwd, palm).normalize();
      for (const f in CURL) CURL[f].forEach((bend, n) => rotateWorld(B[`${f}_0${n + 1}${s}`], curl, bend));
      // the thumb lies along the inside of the hood, pointing forward and down
      aim(B['thumb_01' + s], B['thumb_02' + s], worldPos(B['thumb_01' + s], tmp).addScaledVector(handFwd, 0.75).addScaledVector(palm, 0.55).add(tmp2.set(-side * 0.25, 0, 0)));
      aim(B['thumb_02' + s], B['thumb_03' + s], worldPos(B['thumb_02' + s], tmp).addScaledVector(handFwd, 0.6).addScaledVector(palm, 0.8).add(tmp2.set(side * 0.1, 0, 0)));
      // leg: the ball of the foot sits on the pedal; the ankle drops a little over the top and points on the way down
      geo.pedalPoint(side, crankAngle, pedal);
      const a = crankAngle + (side > 0 ? Math.PI : 0), pitch = 0.2 + 0.16 * Math.sin(a - 0.6);       // toe-down angle
      toeFwd.set(0, -Math.sin(pitch), Math.cos(pitch)); toeUp.set(0, Math.cos(pitch), Math.sin(pitch));
      frameRotation(Z, Y, toeFwd, toeUp, q);
      ankle.copy(ballFromAnkle).applyQuaternion(q).negate().add(pedal).addScaledVector(toeUp, 0.05);
      ankle.x = side * Math.abs(pedal.x);
      twoBone(B['thigh' + s], B['calf' + s], B['foot' + s], ankle, tmp.set(side * 0.06, 0.25, 1));
      setWorldQuat(B['foot' + s], q.multiply(rest['foot' + s].w));
    }
  }
  pose(0);
  return { object, pose, bones, lean, shape };
}
