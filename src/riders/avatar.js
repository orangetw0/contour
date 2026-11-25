/* A rider: a rigged character (Quaternius Universal Base Characters, CC0) dressed in cycling kit and posed on a
   bike. The model is a plain body in a T-pose; here it gets a jersey, bib shorts, socks, shoes and gloves painted
   on by a shader, a helmet and glasses, and a riding position solved each frame: hips on the saddle, hands on the
   hoods, feet following the pedals. Frame: +Z forward, +Y up, +X the rider's left, origin under the bottom bracket. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { worldPos, worldQuat, setWorldQuat, rotateWorld, twoBone, frameRotation } from './ik.js';
import { hipPoint, hoodPoint, pedalPoint } from './bike.js';

const V3 = THREE.Vector3, X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1);
export const CHARACTERS = Object.freeze({ male: 'Male', female: 'Female' });
export const KITS = Object.freeze({
  red: { name: 'Red', jersey: 0xc8202a, trim: 0xf2f2f2, bike: 0xc2202c },
  blue: { name: 'Blue', jersey: 0x1f5fd0, trim: 0xf4d23c, bike: 0x1c4fb0 },
  green: { name: 'Green', jersey: 0x1f9a55, trim: 0x101014, bike: 0x15803f },
  orange: { name: 'Orange', jersey: 0xf07a1a, trim: 0x15151a, bike: 0xe0660f },
  white: { name: 'White', jersey: 0xeeeeee, trim: 0x2a6fe0, bike: 0xdadde2 },
  black: { name: 'Black', jersey: 0x1a1a1e, trim: 0xe83a5e, bike: 0x222226 },
});

const loader = new GLTFLoader(), cache = new Map();
export const loadCharacter = kind => {
  if (!cache.has(kind)) cache.set(kind, loader.loadAsync(`assets/riders/${kind === 'female' ? 'female' : 'male'}.gltf`));
  return cache.get(kind);
};

const ARM = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/, HAND = /^(hand|index|middle|ring|pinky|thumb)/;
const LEG = /^(thigh|calf|foot|ball)/, FOOT = /^(foot|ball)/, HEAD = /^(neck|Head)/;

/* Paint kit onto the body. Each vertex learns how much it belongs to an arm, a leg, a hand or foot, or the head
   (from the skeleton's weights) and how far along its limb it is; the shader draws hems from those. */
function dress(body, joint, kit) {
  const geo = body.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, names = body.skeleton.bones.map(b => b.name);
  if (!geo.attributes.aPart) {                         // worked out once per character; every rider of that character shares it
  const part = new Float32Array(pos.count * 4), head = new Float32Array(pos.count), p = new V3();
  const along = (a, b) => { const d = new V3().subVectors(b, a), l2 = d.lengthSq(); return q => (q.dot(d) - a.dot(d)) / l2; };
  const armT = { 1: along(joint.upperarm_l, joint.hand_l), [-1]: along(joint.upperarm_r, joint.hand_r) }, legT = { 1: along(joint.thigh_l, joint.foot_l), [-1]: along(joint.thigh_r, joint.foot_r) };
  for (let i = 0; i < pos.count; i++) {
    let arm = 0, leg = 0, end = 0, hd = 0;
    for (let k = 0; k < 4; k++) {
      const n = names[si.getComponent(i, k)], w = sw.getComponent(i, k);
      if (ARM.test(n)) arm += w; if (LEG.test(n)) leg += w; if (HAND.test(n) || FOOT.test(n)) end += w; if (HEAD.test(n)) hd += w;
    }
    p.fromBufferAttribute(pos, i);
    const side = p.x >= 0 ? 1 : -1;
    part.set([arm, leg, end, leg > arm ? legT[side](p) : armT[side](p)], i * 4); head[i] = hd;
  }
  geo.setAttribute('aPart', new THREE.BufferAttribute(part, 4));
  geo.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
  }
  const mat = body.material.clone(), c = h => ({ value: new THREE.Color(h) });
  const u = { uJersey: c(kit.jersey), uTrim: c(kit.trim), uBib: c(0x101013), uSock: c(0xf0f0f0), uShoe: c(0xf4f4f4), uGlove: c(0x121214), uSkin: { value: new THREE.Color(kit.skin ?? 0xffffff) },
    uLines: { value: new THREE.Vector4(joint.neck_01.y + 0.035, joint.pelvis.y + 0.075, (joint.spine_03.y + joint.neck_01.y) / 2 - 0.02, 0) } };
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'attribute vec4 aPart; attribute float aHead; varying vec4 vPart; varying float vHead; varying vec3 vRest;\n' + s.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vPart = aPart; vHead = aHead; vRest = position;');
    s.fragmentShader = 'uniform vec3 uJersey, uTrim, uBib, uSock, uShoe, uGlove, uSkin; uniform vec4 uLines; varying vec4 vPart; varying float vHead; varying vec3 vRest;\n' + s.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 skin = diffuseColor.rgb * uSkin, c;
        float arm = vPart.x, leg = vPart.y, end = vPart.z, t = vPart.w;
        vec3 jersey = mix(uJersey, uTrim, smoothstep(0.045, 0.04, abs(vRest.y - uLines.z)));          // a band across the chest
        if (vHead > 0.5) c = skin;
        else if (arm > 0.5) c = end > 0.5 ? uGlove : (t < 0.40 ? (t > 0.33 ? uTrim : uJersey) : skin);       // short sleeves with a cuff
        else if (leg > 0.5) c = end > 0.45 ? uShoe : (t < 0.43 ? (t > 0.40 ? uTrim : uBib) : (t > 0.80 ? uSock : skin));
        else c = vRest.y > uLines.x ? skin : (vRest.y < uLines.y ? uBib : jersey);
        diffuseColor.rgb = c;
      }`);
  };
  mat.customProgramCacheKey = () => 'contour-kit';
  body.material = mat;
  return u;
}

function helmet(model, joint, headBone, body, kit) {
  // the skull's size, from the head's own vertices above the brow
  const pos = body.geometry.attributes.position, hd = body.geometry.attributes.aHead, box = new THREE.Box3(), p = new V3(), brow = joint.Head.y + 0.105;
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); if (hd.getX(i) > 0.9 && p.y > brow) box.expandByPoint(p); }
  const c = box.getCenter(new V3()), size = box.getSize(new V3());
  const shell = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), col = new Float32Array(shell.attributes.position.count * 3), a = new THREE.Color(kit.jersey), b = new THREE.Color(0x0c0c0e);
  for (let i = 0; i < shell.attributes.position.count; i++) {       // dark vents running front to back
    p.fromBufferAttribute(shell.attributes.position, i);
    const vent = p.y > 0.25 && Math.abs(Math.sin(p.x * 9.5)) > 0.8 && Math.abs(p.z) < 0.8;
    (vent ? b : a).toArray(col, i * 3);
  }
  shell.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lid = new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }));
  lid.scale.set(size.x / 2 + 0.024, box.max.y - brow + 0.03, size.z / 2 + 0.034); lid.position.set(c.x, brow, c.z - 0.006);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(size.x / 2 + 0.006, size.x / 2 + 0.006, 0.042, 18, 1, true, -0.95, 1.9), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.15, metalness: 0.6, side: THREE.DoubleSide }));
  lens.position.set(c.x, joint.Head.y + 0.085, box.max.z - size.x / 2 - 0.004);
  for (const m of [lid, lens]) { m.castShadow = true; m.updateMatrix(); m.applyMatrix4(new THREE.Matrix4().copy(headBone.matrixWorld).invert()); headBone.add(m); }
}

export function createAvatar(gltf, { kit = KITS.red } = {}) {
  const model = cloneSkinned(gltf.scene), object = new THREE.Group();
  object.add(model); object.updateMatrixWorld(true);
  const bones = {}, rest = {}, joint = {};
  let body = null;
  model.traverse(o => {
    if (o.isBone) { bones[o.name] = o; rest[o.name] = { q: o.quaternion.clone(), p: o.position.clone(), w: worldQuat(o, new THREE.Quaternion()) }; joint[o.name] = worldPos(o, new V3()); }
    if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; if (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count) body = o; }
  });
  dress(body, joint, kit);
  helmet(model, joint, bones.Head, body, kit);

  const B = bones, spine = [B.pelvis, B.spine_01, B.spine_02, B.spine_03], share = [0.42, 0.2, 0.2, 0.18];
  const armLen = joint.upperarm_l.distanceTo(joint.lowerarm_l) + joint.lowerarm_l.distanceTo(joint.hand_l);
  const ballFromAnkle = new V3().subVectors(joint.ball_l, joint.foot_l), tmp = new V3(), tmp2 = new V3(), q = new THREE.Quaternion(), hips = new V3(), pedal = new V3(), ankle = new V3();
  const hip = hipPoint(), hood = { 1: hoodPoint(1), [-1]: hoodPoint(-1) };
  const fingers = ['index', 'middle', 'ring', 'pinky'].flatMap(f => [1, 2, 3].map(n => `${f}_0${n}`));

  function torso(lean) {
    for (const n in rest) if (!/^(upperarm|lowerarm|hand|thigh|calf|foot|ball|index|middle|ring|pinky|thumb)/.test(n)) { B[n].quaternion.copy(rest[n].q); B[n].position.copy(rest[n].p); }
    model.updateMatrixWorld(true);
    spine.forEach((b, i) => rotateWorld(b, X, lean * share[i]));
    hips.addVectors(worldPos(B.thigh_l, tmp), worldPos(B.thigh_r, tmp2)).multiplyScalar(0.5);
    B.pelvis.position.add(tmp.subVectors(hip, hips)); B.pelvis.updateMatrixWorld(true);
    rotateWorld(B.neck_01, X, -lean * 0.4); rotateWorld(B.Head, X, -lean * 0.42);       // look up the road
  }
  // lean forward just far enough that the arms reach the hoods with a little bend
  let lo = 0.35, hi = 1.3;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2; torso(mid);
    if (worldPos(B.upperarm_l, tmp).distanceTo(hood[1]) > armLen * 0.95) lo = mid; else hi = mid;
  }
  const lean = (lo + hi) / 2;

  const handFwd = new V3(0, -0.45, 1).normalize(), toeFwd = new V3(), toeUp = new V3(), curl = new V3();
  /* crankAngle: radians, 0 with the right pedal up. sway: small side-to-side rock of the shoulders (radians). */
  function pose(crankAngle, sway = 0) {
    for (const n in rest) B[n].quaternion.copy(rest[n].q);
    torso(lean);
    if (sway) rotateWorld(B.spine_02, Z, sway);
    for (const side of [1, -1]) {
      const s = side > 0 ? '_l' : '_r';
      // arm: wrist to the hood, elbow down and slightly out; the hand wraps the hood with the palm inward
      twoBone(B['upperarm' + s], B['lowerarm' + s], B['hand' + s], hood[side], tmp.set(side * 0.45, -1, -0.25));
      const palm = tmp.set(-side, -0.25, 0).normalize();
      setWorldQuat(B['hand' + s], frameRotation(tmp2.set(side, 0, 0), Y.clone().negate(), handFwd, palm, q).multiply(rest['hand' + s].w));
      curl.crossVectors(handFwd, palm).normalize();
      for (const f of fingers) rotateWorld(B[f + s], curl, 0.55);
      // leg: the ball of the foot sits on the pedal; the ankle drops a little over the top and points on the way down
      pedalPoint(side, crankAngle, pedal);
      const a = crankAngle + (side > 0 ? Math.PI : 0), pitch = 0.3 + 0.2 * Math.sin(a - 0.6);       // toe-down angle
      toeFwd.set(0, -Math.sin(pitch), Math.cos(pitch)); toeUp.set(0, Math.cos(pitch), Math.sin(pitch));
      frameRotation(Z, Y, toeFwd, toeUp, q);
      ankle.copy(ballFromAnkle).applyQuaternion(q).negate().add(pedal).addScaledVector(toeUp, 0.04);
      ankle.x = side * Math.abs(pedal.x);
      twoBone(B['thigh' + s], B['calf' + s], B['foot' + s], ankle, tmp.set(side * 0.06, 0.25, 1));
      setWorldQuat(B['foot' + s], q.multiply(rest['foot' + s].w));
    }
  }
  pose(0);
  return { object, pose, bones, lean };
}
