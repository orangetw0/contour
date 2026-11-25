import { describe, it, expect } from 'vitest';
import { buildLine, valleyControl, mkPose } from '../src/course/line.js';
import { createRider, stepRider, uTurn, LANE } from '../src/sim/rider.js';
import { createLoop } from '../src/sim/loop.js';
import { units } from '../src/sim/units.js';
import { bodyOf, DEFAULT_PROFILE } from '../src/sim/profile.js';

const line = buildLine(valleyControl());
const body = bodyOf(DEFAULT_PROFILE);

describe('course line', () => {
  it('is a closed loop sampled about every 1.5 m', () => {
    expect(line.LEN).toBeGreaterThan(2500); expect(line.LEN).toBeLessThan(4000);
    expect(line.LEN / line.N).toBeCloseTo(1.5, 1);
    const a = line.at(0, mkPose()).p.clone(), b = line.at(line.LEN, mkPose()).p;
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
  });
  it('wraps negative and large distances', () => {
    const a = line.at(-10, mkPose()).p.clone(), b = line.at(line.LEN - 10, mkPose()).p;
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
  });
  it('gives unit tangents and level right vectors', () => {
    const p = line.at(1234, mkPose());
    expect(p.t.length()).toBeCloseTo(1, 6); expect(p.r.y).toBe(0); expect(p.t.dot(p.r)).toBeCloseTo(0, 6);
  });
  it('finds the road from a point beside it', () => {
    const p = line.at(500, mkPose()), x = p.p.x + p.r.x * 5, z = p.p.z + p.r.z * 5;
    const n = line.nearRoad(x, z);
    expect(n.d).toBeGreaterThan(4.5); expect(n.d).toBeLessThan(5.5); expect(n.side).toBeGreaterThan(0);
    expect(Math.abs(line.nearestS(x, z).s - 500)).toBeLessThan(3);
  });
});

describe('rider', () => {
  it('covers distance equal to speed times time, and wraps the loop', () => {
    const r = createRider({ body, s: line.LEN - 5 });
    let d = 0; for (let i = 0; i < 600; i++) { stepRider(r, line, 1 / 60); d += r.v / 60; }
    expect(r.dist).toBeCloseTo(d, 6);
    expect(r.s).toBeLessThan(line.LEN); expect(r.s).toBeGreaterThan(0);
  });
  it('eases power toward the target', () => {
    const r = createRider({ body, power: 100 }); r.target = 300;
    for (let i = 0; i < 300; i++) stepRider(r, line, 1 / 60);
    expect(r.power).toBeGreaterThan(299);
  });
  it('tracks altitude and ride time', () => {
    const r = createRider({ body, s: 300 });
    for (let i = 0; i < 120; i++) stepRider(r, line, 1 / 60);
    expect(r.time).toBeCloseTo(2, 6); expect(r.altitude).toBeCloseTo(line.at(r.s, mkPose()).p.y, 0);
  });
  it('holds a cruise speed in scenery mode', () => {
    const r = createRider({ body });
    for (let i = 0; i < 1200; i++) stepRider(r, line, 1 / 60, { cruise: 5 });
    expect(r.v).toBeCloseTo(5, 3);
  });
  it('reports the gradient of the road it is on', () => {
    const r = createRider({ body, s: 700 });
    for (let i = 0; i < 30; i++) stepRider(r, line, 1 / 60, { cruise: 0.0001 });
    expect(r.grade).toBeCloseTo(line.at(700, mkPose()).t.y * 100 * (1 - Math.pow(1 - 2 / 60, 30)), 1);
  });
});

describe('steering and U-turns', () => {
  const run = (r, secs, opts) => { for (let i = 0; i < secs * 60; i++) stepRider(r, line, 1 / 60, opts); };
  it('moves across the lane while a key is held, and stays in the lane', () => {
    const r = createRider({ body, v: 8 }); r.steer = 1; run(r, 0.5);
    expect(r.lane).toBeGreaterThan(-1.75); expect(r.slide).toBeGreaterThan(0);
    run(r, 5); expect(r.lane).toBe(LANE.centre);
    r.steer = -1; run(r, 6); expect(r.lane).toBe(LANE.edge);
    r.steer = 0; run(r, 1); expect(r.lane).toBe(LANE.edge); expect(r.slide).toBe(0);
  });
  it('a U-turn reverses the ride and brings the rider back to their own side', () => {
    const r = createRider({ body, v: 9, s: 1000 }); run(r, 1);
    const s0 = r.s, g0 = line.at(r.s, mkPose()).t.y;
    expect(uTurn(r)).toBe(true); expect(uTurn(r)).toBe(false);          // not again until this one is finished
    expect(r.dir).toBe(-1); expect(r.lane).toBeCloseTo(1.75); expect(r.v).toBeLessThanOrEqual(2.5);
    run(r, 4);
    expect(r.s).toBeLessThan(s0); expect(r.uturn).toBe(0);
    expect(r.lane).toBeLessThanOrEqual(LANE.centre); expect(r.lane).toBeGreaterThanOrEqual(LANE.edge);
    expect(Math.sign(r.grade)).toBe(-Math.sign(line.at(r.s, mkPose()).t.y) || 0);
    expect(g0).toBeDefined();
    expect(uTurn(r)).toBe(true); expect(r.dir).toBe(1);
  });
  it('wraps the loop when riding backwards', () => {
    const r = createRider({ body, v: 9, s: 3 }); uTurn(r); r.v = 9; run(r, 2);
    expect(r.s).toBeGreaterThan(line.LEN - 40); expect(r.s).toBeLessThan(line.LEN);
  });
});

describe('loop', () => {
  it('runs one step per timestep of real time, however it is called', () => {
    let n = 0; const loop = createLoop(() => n++, { hz: 60 });
    loop.advance(0); loop.advance(1000);
    expect(Math.abs(n - 60)).toBeLessThanOrEqual(1);          // the last step can fall either side of a rounding error
    for (let t = 1000; t <= 2000; t += 7) loop.advance(t);
    loop.advance(2000);
    expect(Math.abs(n - 120)).toBeLessThanOrEqual(1);
  });
  it('keeps the ride moving on slow ticks, as in a hidden tab', () => {
    const r = createRider({ body }), loop = createLoop(h => stepRider(r, line, h));
    for (let t = 0; t <= 60000; t += 250) loop.advance(t);
    expect(r.dist).toBeGreaterThan(300);
  });
  it('does not replay a long stall', () => {
    let n = 0; const loop = createLoop(() => n++, { hz: 60, maxCatchUp: 2 });
    loop.advance(0); loop.advance(3600000);
    expect(Math.abs(n - 120)).toBeLessThanOrEqual(1);
  });
  it('reports the time left over between steps', () => {
    const loop = createLoop(() => {}, { hz: 10 });
    loop.advance(0); loop.advance(250);
    expect(loop.leftover()).toBeCloseTo(0.05, 9);
  });
});

describe('units', () => {
  it('converts speed and distance', () => {
    const m = units('metric'), i = units('imperial');
    expect(m.speed(10)).toBeCloseTo(36); expect(m.speedLabel).toBe('km/h');
    expect(i.speed(10)).toBeCloseTo(22.369, 3); expect(i.distance(1609.344)).toBeCloseTo(1); expect(i.distanceLabel).toBe('mi');
    expect(i.height(100)).toBeCloseTo(328.084, 3); expect(i.weight(80)).toBeCloseTo(176.37, 2);
  });
  it('falls back to metric', () => { expect(units('furlongs').system).toBe('metric'); });
});
