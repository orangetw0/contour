import { describe, it, expect } from 'vitest';
import { climbAhead } from '../src/sim/climb.js';
import { createTally } from '../src/sim/tally.js';

describe('the climb ahead', () => {
  const flat = () => 100;
  // flat for 200 m, then 6 % for 2 km, then flat
  const hill = d => 100 + Math.max(0, Math.min(2000, d - 200)) * 0.06;
  it('finds nothing on a flat road', () => { expect(climbAhead(flat)).toBeNull(); });
  it('finds a climb that starts just up the road, with its length, gain and gradient', () => {
    const c = climbAhead(hill, { threshold: 3 });
    expect(c.start).toBeGreaterThanOrEqual(150); expect(c.start).toBeLessThanOrEqual(200);
    expect(c.end).toBeGreaterThan(2100); expect(c.end).toBeLessThan(2400);
    expect(c.gain).toBeGreaterThan(110); expect(c.gain).toBeLessThanOrEqual(120);
    expect(c.avg).toBeGreaterThan(5); expect(c.avg).toBeLessThan(6.1);
    expect(c.heights.length).toBeGreaterThan(c.end / c.step);
  });
  it('ignores a climb gentler than the threshold', () => { expect(climbAhead(d => 100 + d * 0.02, { threshold: 3 })).toBeNull(); });
  it('ignores a climb that begins too far away to matter yet', () => { expect(climbAhead(d => hill(d - 1500), { threshold: 3 })).toBeNull(); });
  it('ignores a bump', () => { expect(climbAhead(d => 100 + Math.max(0, Math.min(100, d)) * 0.06, { threshold: 3 })).toBeNull(); });
  it('stops at the end of the road', () => { const c = climbAhead(hill, { threshold: 3, limit: 1000 }); expect(c.end).toBeLessThanOrEqual(1000); });
  it('looks down a descent and sees no climb', () => { expect(climbAhead(d => 500 - d * 0.07)).toBeNull(); });
});

describe('ride totals', () => {
  it('adds up work, averages and climbing', () => {
    const t = createTally();
    for (let i = 0; i < 60 * 60; i++) t.step(200, 8, 100 + i / 60 * 0.5, 1 / 60);       // a minute at 200 W and 8 m/s, climbing half a metre a second
    expect(t.kj).toBeCloseTo(12, 1); expect(t.avgPower).toBeCloseTo(200, 0); expect(t.avgSpeed).toBeCloseTo(8, 1);
    expect(t.ascent).toBeCloseTo(30, 0); expect(t.np).toBeCloseTo(200, 0);
  });
  it('does not count a jump up the road as climbing, or standing still as riding', () => {
    const t = createTally();
    t.step(0, 0, 100, 1); t.step(0, 0, 400, 1);
    expect(t.ascent).toBe(0); expect(t.avgSpeed).toBe(0); expect(t.np).toBeNull();
  });
});
