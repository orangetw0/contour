import { describe, it, expect } from 'vitest';
import { gatesFor, createLaps, createGateWatch } from '../src/sim/lap.js';

// ride from a to b in 1 m steps, collecting what the watch reports
const ride = (w, a, b, LEN, closed) => {
  const hits = [], dir = Math.sign(b - a);
  for (let s = a; dir > 0 ? s <= b : s >= b; s += dir) { const h = w.step(closed ? ((s % LEN) + LEN) % LEN : s); if (h) hits.push(h.kind); }
  return hits;
};

describe('gatesFor', () => {
  it('puts one lap line just ahead of the start of a loop', () => {
    expect(gatesFor({ LEN: 3000, closed: true }, 0)).toEqual({ lap: 20 });
    expect(gatesFor({ LEN: 3000, closed: true }, 2990).lap).toBe(10);
  });
  it('puts an arch near each end of an out-and-back', () => {
    expect(gatesFor({ LEN: 10000, closed: false }, 5)).toEqual({ home: 35, far: 9960 });
  });
});

describe('createLaps', () => {
  it('gives each stretch as the difference of running totals', () => {
    const laps = createLaps();
    expect(laps.mark({ time: 600, dist: 3000, ascent: 80, kj: 120 })).toEqual({ time: 600, dist: 3000, ascent: 80, avgPower: 200 });
    expect(laps.peek({ time: 700, dist: 3500, ascent: 85, kj: 150 })).toEqual({ time: 100, dist: 500, ascent: 5, avgPower: 300 });
    const second = laps.mark({ time: 1000, dist: 6000, ascent: 160, kj: 220 });
    expect(second).toEqual({ time: 400, dist: 3000, ascent: 80, avgPower: 250 });
    expect(laps.count).toBe(2);
    expect(laps.total({ time: 1000, dist: 6000, ascent: 160, kj: 220 }).avgPower).toBe(220);
  });
  it('does not divide by zero', () => { expect(createLaps().mark({ time: 0, dist: 0, ascent: 0, kj: 0 }).avgPower).toBe(0); });
});

describe('createGateWatch on a loop', () => {
  const L = { LEN: 3000, closed: true };
  it('ignores the first crossing, then counts each full lap', () => {
    const w = createGateWatch(L, 0);
    expect(ride(w, 0, 100, 3000, true)).toEqual([]);
    expect(ride(w, 101, 3100, 3000, true)).toEqual(['lap']);
    expect(ride(w, 3101, 9100, 3000, true)).toEqual(['lap', 'lap']);
  });
  it('ignores a U-turn back over the line and a skip back and forward', () => {
    const w = createGateWatch(L, 0);
    ride(w, 0, 1500, 3000, true);
    expect(ride(w, 1499, -100, 3000, true)).toEqual([]);          // back the wrong way over the line
    expect(ride(w, -99, 200, 3000, true)).toEqual([]);            // and forward again: not a lap
    expect(w.step(3000 - 50)).toBe(null);                         // skip back 250 m over the line
    expect(w.step(200)).toBe(null);                               // skip forward again
    expect(ride(w, 201, 3030, 3000, true)).toEqual(['lap']);
  });
  it('counts a lap ridden the other way round', () => {
    const w = createGateWatch(L, 0);
    expect(ride(w, 0, -2990, 3000, true)).toEqual(['lap']);
  });
  it('counts a crossing made by a skip, and road skipped as road covered', () => {
    const w = createGateWatch(L, 0);
    ride(w, 0, 50, 3000, true);
    for (let s = 300; s <= 2800; s += 250) expect(w.step(s)).toBe(null);
    expect(w.step(2800 + 250 - 3000)).toEqual({ kind: 'lap' });
  });
});

describe('createGateWatch on an out-and-back', () => {
  const L = { LEN: 10000, closed: false };
  it('reports the far arch on the way out and the home arch on the way back, once each', () => {
    const w = createGateWatch(L, 5);
    expect(ride(w, 5, 10000, 10000, false)).toEqual(['far']);
    expect(ride(w, 10000, 0, 10000, false)).toEqual(['home']);
    expect(ride(w, 0, 10000, 10000, false)).toEqual(['far']);     // the home arch on the way out again says nothing
  });
  it('ignores turning back before the far arch, and riding to and fro under it', () => {
    const w = createGateWatch(L, 5);
    ride(w, 5, 5000, 10000, false);
    expect(ride(w, 5000, 0, 10000, false)).toEqual([]);
    expect(ride(w, 0, 9980, 10000, false)).toEqual(['far']);
    expect(ride(w, 9980, 9900, 10000, false)).toEqual([]);
    expect(ride(w, 9900, 9990, 10000, false)).toEqual([]);
  });
});
