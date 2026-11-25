/* Posing helpers for a skeleton, working in world space so they don't depend on how a model's bones are oriented.
   Every helper leaves the bone's matrices up to date, children included. */
import * as THREE from 'three';

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _d = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _dir = new THREE.Vector3(), _pole = new THREE.Vector3(), _elbow = new THREE.Vector3();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

export const worldPos = (obj, out) => out.setFromMatrixPosition(obj.matrixWorld);
export const worldQuat = (obj, out) => { obj.matrixWorld.decompose(_p, out, _s); return out; };

export function setWorldQuat(bone, q) {
  if (bone.parent) worldQuat(bone.parent, _pq).invert(); else _pq.identity();
  bone.quaternion.copy(_pq).multiply(q);
  bone.updateMatrixWorld(true);
}

// turn a bone about a world axis through its own joint
export function rotateWorld(bone, axis, angle) {
  worldQuat(bone, _q);
  setWorldQuat(bone, _d.setFromAxisAngle(axis, angle).multiply(_q));
}

// turn a bone so that its child joint lies toward a world point
export function aim(bone, child, target) {
  worldPos(bone, _a); worldPos(child, _b);
  _b.sub(_a).normalize(); _c.copy(target).sub(_a).normalize();
  worldQuat(bone, _q);
  setWorldQuat(bone, _d.setFromUnitVectors(_b, _c).multiply(_q));
}

/* Two-bone reach (shoulder-elbow-wrist, hip-knee-ankle): put `end` on `target`, bending toward `pole` (a direction).
   If the target is out of reach the limb straightens toward it. */
export function twoBone(upper, lower, end, target, pole) {
  worldPos(upper, _a); worldPos(lower, _b); worldPos(end, _c);
  const l1 = _b.distanceTo(_a), l2 = _c.distanceTo(_b);
  _dir.copy(target).sub(_a);
  const d = Math.min(Math.max(_dir.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  _dir.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_pole.lengthSq() < 1e-10) _pole.set(_dir.y, _dir.z, _dir.x).addScaledVector(_dir, -_pole.dot(_dir));
  _pole.normalize();
  _elbow.copy(_a).addScaledVector(_dir, x).addScaledVector(_pole, h);
  const reach = new THREE.Vector3().copy(_a).addScaledVector(_dir, d), elbow = _elbow.clone();
  aim(upper, lower, elbow);
  aim(lower, end, reach);
}

// the rotation that carries one pair of directions (forward, up) onto another
export function frameRotation(fromFwd, fromUp, toFwd, toUp, out = new THREE.Quaternion()) {
  const basis = (f, u, m) => { _z.copy(f).normalize(); _x.crossVectors(u, _z).normalize(); _y.crossVectors(_z, _x); return m.makeBasis(_x, _y, _z); };
  basis(fromFwd, fromUp, _m1); basis(toFwd, toUp, _m2);
  return out.setFromRotationMatrix(_m2.multiply(_m1.transpose()));
}
