import { describe, it, expect } from 'vitest';
import { shapeOf, buildTopology, reshape } from '../src/riders/body.js';

// a toy "arm": a square tube along +X from the shoulder (x=0) to the hand (x=1), skinned to one bone
function tube() {
  const pos = [], idx = [], rings = 6;
  for (let r = 0; r < rings; r++) for (const [y, z] of [[0.1, 0.1], [-0.1, 0.1], [-0.1, -0.1], [0.1, -0.1]]) pos.push(r / (rings - 1), y, z);
  for (let r = 0; r < rings - 1; r++) for (let k = 0; k < 4; k++) { const a = r * 4 + k, b = r * 4 + (k + 1) % 4; idx.push(a, b, a + 4, b, b + 4, a + 4); }
  const n = pos.length / 3;
  return { pos: Float32Array.from(pos), idx, skinIndex: new Uint16Array(n * 4), skinWeight: Float32Array.from({ length: n * 4 }, (_, i) => i % 4 === 0 ? 1 : 0) };
}
const joints = { upperarm_l: [0, 0, 0], lowerarm_l: [1, 0, 0], spine_01: [0, 0, 0] };

describe('body shape', () => {
  it('a lean man gets much slimmer arms and narrower shoulders than the model; a woman changes less', () => {
    const m = shapeOf({ sex: 'male', kg: 68, heightM: 1.78 }), f = shapeOf({ sex: 'female', kg: 58, heightM: 1.66 });
    expect(m.girth.upperarm).toBeLessThan(0.72); expect(m.shoulders).toBeLessThan(0.86); expect(m.trunk.spine_03[0]).toBeLessThan(0.86);
    expect(f.girth.upperarm).toBeGreaterThan(m.girth.upperarm + 0.1); expect(f.shoulders).toBeGreaterThan(0.9);
  });
  it('more weight at the same height goes on the waist first, mostly in front, and least on the arms', () => {
    const lean = shapeOf({ kg: 66, heightM: 1.8 }), heavy = shapeOf({ kg: 100, heightM: 1.8 });
    expect(heavy.build).toBeGreaterThan(lean.build + 1);
    const grow = (a, b) => b / a, belly = grow(lean.trunk.spine_01[1], heavy.trunk.spine_01[1]), back = grow(lean.trunk.spine_01[2], heavy.trunk.spine_01[2]);
    expect(belly).toBeGreaterThan(1.4); expect(belly).toBeGreaterThan(back + 0.25);
    expect(belly).toBeGreaterThan(grow(lean.trunk.spine_03[1], heavy.trunk.spine_03[1])); expect(grow(lean.girth.upperarm, heavy.girth.upperarm)).toBeLessThan(belly);
    expect(heavy.girth.thigh).toBeGreaterThan(lean.girth.thigh);
  });
  it('height matters: the same weight on a taller rider is a slighter build', () => {
    expect(shapeOf({ kg: 75, heightM: 1.92 }).build).toBeLessThan(shapeOf({ kg: 75, heightM: 1.68 }).build);
  });
  it('keeps extreme inputs within sane limits', () => {
    expect(shapeOf({ kg: 200, heightM: 1.5 }).build).toBe(1.6); expect(shapeOf({ kg: 35, heightM: 2 }).build).toBe(-0.5);
  });
});

describe('reshaping a mesh', () => {
  const t = tube(), topo = buildTopology(t.pos, t.idx);
  it('finds neighbours', () => { expect(topo.groups).toBe(24); expect(topo.neighbours[0].length).toBeGreaterThanOrEqual(3); });
  it('scales girth about the limb and leaves its length alone', () => {
    const shape = { girth: { upperarm: 0.5 }, trunk: {}, smooth: 0 }, out = reshape(t.pos, t.skinIndex, t.skinWeight, ['upperarm_l'], joints, shape, topo);
    for (let i = 0; i < out.length; i += 3) { expect(out[i]).toBeCloseTo(t.pos[i], 6); expect(Math.abs(out[i + 1])).toBeCloseTo(0.05, 6); expect(Math.abs(out[i + 2])).toBeCloseTo(0.05, 6); }
  });
  it('scales the trunk by width, and by depth differently in front and behind', () => {
    const shape = { girth: {}, trunk: { spine_01: [1.2, 1.5, 0.9] }, smooth: 0 }, out = reshape(t.pos, t.skinIndex, t.skinWeight, ['spine_01'], joints, shape, topo);
    expect(out[0 + 5 * 12]).toBeCloseTo(1.2, 6);                         // x of a point at x = 1
    expect(out[2]).toBeCloseTo(0.15, 6); expect(out[8]).toBeCloseTo(-0.09, 6); expect(out[1]).toBeCloseTo(0.1, 6);
  });
  it('leaves bones it has no rule for untouched', () => {
    const out = reshape(t.pos, t.skinIndex, t.skinWeight, ['Head'], joints, { girth: {}, trunk: {}, smooth: 0 }, topo);
    expect(Array.from(out)).toEqual(Array.from(t.pos));
  });
  it('smoothing pulls points toward their neighbours, except where told to keep detail', () => {
    const shape = { girth: {}, trunk: {}, smooth: 0.7 }, soft = reshape(t.pos, t.skinIndex, t.skinWeight, ['Head'], joints, shape, topo);
    expect(Math.abs(soft[4 * 3 + 1])).toBeLessThan(0.1);
    const kept = reshape(t.pos, t.skinIndex, t.skinWeight, ['Head'], joints, shape, topo, new Float32Array(24).fill(1));
    expect(Array.from(kept)).toEqual(Array.from(t.pos));
  });
});
