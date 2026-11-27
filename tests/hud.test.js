import { describe, it, expect } from 'vitest';
import { climbAhead, climbProgress } from '../src/sim/climb.js';
import { cleanHud } from '../src/app/hud.js';
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
  it('starts its picture at the rider when the climb is still ahead', () => { const c = climbAhead(hill, { behind: 5000 }); expect(c.from).toBe(0); expect(c.start).toBeGreaterThan(0); });
  it('gives a rider already on the climb the whole of it, from the foot', () => {
    const c = climbAhead(d => hill(d + 1000), { behind: 5000 });                       // 800 m up the 2 km climb
    expect(c.start).toBeLessThanOrEqual(-775); expect(c.start).toBeGreaterThanOrEqual(-850);
    expect(c.end).toBeGreaterThan(1150); expect(c.end).toBeLessThan(1400);
    expect(c.gain).toBeGreaterThan(115); expect(c.gain).toBeLessThanOrEqual(120.01);
    expect(c.from).toBeLessThan(c.start); expect(c.from).toBeGreaterThanOrEqual(c.start - 150);   // a short run-in
    expect(c.heights.length).toBe(Math.round((c.end - c.from) / c.step) + 7);
    expect(c.heights[Math.round(-c.from / c.step)]).toBeCloseTo(hill(1000), 5);          // the rider's own height is where it should be
  });
  it('does not look behind unless told the road goes back, or past where it begins', () => {
    expect(climbAhead(d => hill(d + 1000)).start).toBe(0);
    expect(climbAhead(d => hill(d + 1000), { behind: 300 }).start).toBe(-300);
  });
});

describe('progress up a climb', () => {
  const hill = d => 100 + Math.max(0, Math.min(2000, d - 200)) * 0.06, c = climbAhead(hill);
  it('counts down to the foot, then to the top', () => {
    const p = climbProgress(c, 0);
    expect(p.toFoot).toBe(c.start); expect(p.toTop).toBe(c.end); expect(p.toGain).toBeCloseTo(c.gain, 5); expect(p.avg).toBeCloseTo(c.avg, 5); expect(p.height).toBeCloseTo(100, 5);
    const q = climbProgress(c, 1200);
    expect(q.toFoot).toBe(0); expect(q.toTop).toBe(c.end - 1200); expect(q.height).toBeCloseTo(160, 5); expect(q.toGain).toBeCloseTo(60, 5); expect(q.avg).toBeGreaterThan(5);
    expect(climbProgress(c, 1212.5).height).toBeCloseTo(160.75, 5);                      // between two samples
  });
  it('has nothing left at the top or beyond', () => {
    const p = climbProgress(c, c.end + 500);
    expect(p.toTop).toBe(0); expect(p.toGain).toBe(0); expect(p.avg).toBeCloseTo(c.avg, 5); expect(p.height).toBeCloseTo(220, 5);
  });
  it('places a rider who joined part-way up', () => {
    const m = climbAhead(d => hill(d + 1000), { behind: 5000 }), p = climbProgress(m, 0);
    expect(p.height).toBeCloseTo(hill(1000), 5); expect(p.toFoot).toBe(0); expect(p.toTop).toBe(m.end); expect(p.toGain).toBeCloseTo(220 - hill(1000), 5);
  });
});

describe('display choices', () => {
  it('keeps the climb view open unless it was tucked away', () => {
    expect(cleanHud(null).climbOpen).toBe(true); expect(cleanHud({ climbOpen: false }).climbOpen).toBe(false); expect(cleanHud({ climbOpen: 'x' }).climbOpen).toBe(true);
  });
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
