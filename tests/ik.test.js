import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { twoBone, aim, rotateWorld, worldPos, frameRotation, setWorldQuat, worldQuat } from '../src/riders/ik.js';
import { GEO, makeGeo } from '../src/riders/bike.js';

const { pedalPoint, hipPoint, hoodPoint } = GEO;

const V3 = THREE.Vector3;
function limb() {       // a 0.45 + 0.45 m leg hanging down from a tilted parent, like a thigh, calf and foot
  const root = new THREE.Group(); root.rotation.set(0.3, 0.5, -0.2); root.position.set(0.1, 1, -0.2);
  const upper = new THREE.Bone(), lower = new THREE.Bone(), end = new THREE.Bone();
  upper.rotation.set(0.1, 0.2, 0.3); lower.position.set(0, -0.45, 0); end.position.set(0, -0.45, 0);
  root.add(upper); upper.add(lower); lower.add(end); root.updateMatrixWorld(true);
  return { root, upper, lower, end };
}

describe('posing helpers', () => {
  it('reaches a target within range, keeping bone lengths, with the joint toward the pole', () => {
    const { upper, lower, end } = limb(), a = worldPos(upper, new V3()), target = a.clone().add(new V3(0.1, -0.6, 0.3));
    twoBone(upper, lower, end, target, new V3(0, 0, 1));
    expect(worldPos(end, new V3()).distanceTo(target)).toBeLessThan(1e-5);
    const knee = worldPos(lower, new V3());
    expect(knee.distanceTo(a)).toBeCloseTo(0.45, 5); expect(knee.distanceTo(target)).toBeCloseTo(0.45, 5);
    const mid = a.clone().add(target).multiplyScalar(0.5);
    expect(knee.z - mid.z).toBeGreaterThan(0.05);
  });
  it('straightens toward a target that is out of reach', () => {
    const { upper, lower, end } = limb(), a = worldPos(upper, new V3()), target = a.clone().add(new V3(0, -2, 0));
    twoBone(upper, lower, end, target, new V3(0, 0, 1));
    const e = worldPos(end, new V3());
    expect(e.distanceTo(a)).toBeCloseTo(0.9, 3); expect(Math.abs(e.x - a.x)).toBeLessThan(1e-3); expect(e.y).toBeLessThan(a.y - 0.89);
  });
  it('aims a bone at a point and turns one about a world axis', () => {
    const { upper, lower } = limb(), a = worldPos(upper, new V3());
    aim(upper, lower, a.clone().add(new V3(1, 0, 0)));
    expect(worldPos(lower, new V3()).sub(a).normalize().x).toBeCloseTo(1, 5);
    rotateWorld(upper, new V3(0, 0, 1), Math.PI / 2);
    expect(worldPos(lower, new V3()).sub(a).normalize().y).toBeCloseTo(1, 5);
  });
  it('builds the rotation between two frames', () => {
    const q = frameRotation(new V3(0, 0, 1), new V3(0, 1, 0), new V3(1, 0, 0), new V3(0, 0, 1));
    expect(new V3(0, 0, 1).applyQuaternion(q).x).toBeCloseTo(1); expect(new V3(0, 1, 0).applyQuaternion(q).z).toBeCloseTo(1);
    const { upper } = limb(); setWorldQuat(upper, q);
    expect(worldQuat(upper, new THREE.Quaternion()).angleTo(q)).toBeLessThan(1e-5);
  });
});

describe('bike contact points', () => {
  it('pedals sit opposite each other on a circle round the bottom bracket, the right one leading', () => {
    for (const a of [0, 1, 2.5, 4]) {
      const r = pedalPoint(-1, a), l = pedalPoint(1, a);
      expect(Math.hypot(r.y - GEO.bbY, r.z)).toBeCloseTo(GEO.crank); expect(r.y + l.y).toBeCloseTo(2 * GEO.bbY); expect(r.z + l.z).toBeCloseTo(0);
    }
    expect(pedalPoint(-1, 0).y).toBeCloseTo(GEO.bbY + GEO.crank); expect(pedalPoint(-1, Math.PI / 2).z).toBeCloseTo(GEO.crank);
  });
  it('puts the hips over the saddle and the hands ahead of them on either side', () => {
    expect(hipPoint().y).toBeGreaterThan(GEO.saddle.y); expect(hoodPoint(1).x).toBeGreaterThan(0); expect(hoodPoint(-1).x).toBeLessThan(0);
    expect(hoodPoint(1).z).toBeGreaterThan(hipPoint().z + 0.6);
  });
  it('a smaller frame brings the saddle down and the bars closer, with the same wheels and cranks', () => {
    const s = makeGeo(0.9), l = makeGeo(1.08);
    expect(s.saddle.y).toBeLessThan(GEO.saddle.y); expect(l.saddle.y).toBeGreaterThan(GEO.saddle.y);
    expect(s.hoodPoint(1).z - s.hipPoint().z).toBeLessThan(hoodPoint(1).z - hipPoint().z);
    expect(s.wheelR).toBe(GEO.wheelR); expect(s.crank).toBe(GEO.crank); expect(s.frontZ).toBeLessThan(l.frontZ);
    expect(makeGeo(3).size).toBe(1.12);
  });
});
