import { describe, it, expect } from 'vitest';
import { acceleration, stepSpeed, steadySpeed, airDensity, REAL, LEGACY, G } from '../src/sim/physics.js';
import { bodyOf, DEFAULT_PROFILE, BIKES, cleanProfile, loadProfile, saveProfile } from '../src/sim/profile.js';
import { buildLine, valleyControl } from '../src/course/line.js';
import { buildSpeedLimit } from '../src/course/speedLimit.js';

const body = bodyOf(DEFAULT_PROFILE);
const kmh = v => v * 3.6;

describe('realistic physics', () => {
  it('200 W on the flat is about 34 km/h', () => {
    const v = kmh(steadySpeed(200, 0, body));
    expect(v).toBeGreaterThan(33); expect(v).toBeLessThan(35);
  });
  it('steady climbing balances power against gravity, rolling and drag', () => {
    const v = steadySpeed(250, 0.08, body), cos = Math.sqrt(1 - 0.08 ** 2);
    expect(v * (80 * G * (0.08 + 0.004 * cos) + 0.5 * 1.225 * 0.32 * v * v)).toBeCloseTo(250 * REAL.drivetrain, 1);
  });
  it('descents count in full: coasting down 10 % passes 65 km/h', () => {
    expect(kmh(steadySpeed(0, -0.10, body))).toBeGreaterThan(65);
    expect(kmh(steadySpeed(0, -0.10, body))).toBeGreaterThan(kmh(steadySpeed(0, -0.10, body, LEGACY)) + 15);
  });
  it('a heavier rider climbs slower and descends faster', () => {
    const heavy = { ...body, mass: 95 };
    expect(steadySpeed(250, 0.08, heavy)).toBeLessThan(steadySpeed(250, 0.08, body));
    expect(steadySpeed(0, -0.06, heavy)).toBeGreaterThan(steadySpeed(0, -0.06, body));
  });
  it('a time-trial bike is faster on the flat, a climbing bike uphill', () => {
    const on = bike => bodyOf({ ...DEFAULT_PROFILE, bike });
    expect(steadySpeed(250, 0, on('tt'))).toBeGreaterThan(steadySpeed(250, 0, on('allround')) + 0.8);
    expect(steadySpeed(250, 0.09, on('climbing'))).toBeGreaterThan(steadySpeed(250, 0.09, on('tt')));
  });
  it('thinner air at altitude makes the flat faster', () => {
    expect(airDensity(0)).toBeCloseTo(1.225); expect(airDensity(2000)).toBeCloseTo(1.003, 2);
    expect(steadySpeed(250, 0, body, REAL, { altitude: 2000 })).toBeGreaterThan(steadySpeed(250, 0, body));
  });
  it('the rider can stop, and does not roll backwards uphill', () => {
    let v = 5; for (let i = 0; i < 2000; i++) v = stepSpeed(v, 0, 0.08, body, 0.05);
    expect(v).toBe(0);
  });
  it('pulls away from a standstill without a jolt', () => {
    expect(acceleration(0, 400, 0, body)).toBeLessThanOrEqual(REAL.maxAccel);
    let v = 0; for (let i = 0; i < 20 * 20; i++) v = stepSpeed(v, 250, 0, body, 0.05);
    expect(kmh(v)).toBeGreaterThan(30);
  });
  it('brakes to a bend limit no harder than its braking rate, then holds it', () => {
    let v = 20; const env = { vLimit: 8 }, first = stepSpeed(v, 0, -0.08, body, 0.1, REAL, env);
    expect(first).toBeCloseTo(20 - REAL.brakeDecel * 0.1, 9);
    for (let i = 0; i < 100; i++) v = stepSpeed(v, 0, -0.08, body, 0.1, REAL, env);
    expect(v).toBe(8);
  });
  it('never exceeds the top speed', () => { expect(steadySpeed(0, -0.25, body)).toBeLessThanOrEqual(REAL.maxSpeed); });
});

describe('corner speed limits', () => {
  const line = buildLine(valleyControl()), lim = buildSpeedLimit(line), ds = line.LEN / line.N;
  it('is slower in tighter bends', () => {
    let tight = 0, straight = 0;
    for (let i = 0; i < line.N; i++) { if (lim.kappa[i] > lim.kappa[tight]) tight = i; if (lim.kappa[i] < lim.kappa[straight]) straight = i; }
    expect(lim.v[tight]).toBeLessThan(lim.v[straight]);
    expect(lim.v[tight] ** 2 * lim.kappa[tight]).toBeLessThanOrEqual(4 + 1e-3);
  });
  it('always leaves room to brake for what is ahead, round the whole loop', () => {
    for (let i = 0; i < line.N; i++) expect(lim.v[i] ** 2).toBeLessThanOrEqual(lim.v[(i + 1) % line.N] ** 2 + 2 * 3 * ds + 1e-2);
  });
  it('interpolates along the road and wraps', () => {
    expect(lim.at(0)).toBeCloseTo(lim.v[0], 6); expect(lim.at(line.LEN)).toBeCloseTo(lim.v[0], 4); expect(lim.at(-ds)).toBeCloseTo(lim.v[line.N - 1], 3);
  });
});

describe('original physics, kept as ?physics=legacy', () => {
  const old = { mass: 80, cda: 0.32, crr: 0.004 };
  it('matches the original force formula', () => {
    const v = 8, p = 220, slope = 0.05;
    expect(acceleration(v, p, slope, old, LEGACY)).toBeCloseTo((p / v - 80 * 9.81 * (slope + 0.004) - 0.5 * 1.2 * 0.32 * v * v) / 80, 12);
  });
  it('descents count half and the brakes come on above 54 km/h', () => {
    const v = 18, slope = -0.08;
    expect(acceleration(v, 0, slope, old, LEGACY)).toBeCloseTo((-80 * G * (slope * 0.5 + 0.004) - 0.5 * 1.2 * 0.32 * v * v - 80 * 0.5 * (v - 15)) / 80, 12);
  });
  it('never drops below its minimum speed', () => { expect(stepSpeed(0.5, 0, 0.2, old, 0.1, LEGACY)).toBe(LEGACY.minSpeed); });
});

describe('profile', () => {
  const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v) }; };
  it('defaults to a 72 kg rider on an 8 kg all-round bike', () => {
    expect(body).toEqual({ mass: 80, riderKg: 72, cda: 0.32, crr: 0.004 });
  });
  it('falls back to defaults on junk', () => {
    expect(cleanProfile('nope')).toEqual(DEFAULT_PROFILE);
    expect(loadProfile({ getItem: () => '{bad json' })).toEqual(DEFAULT_PROFILE);
    expect(loadProfile({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_PROFILE);
    expect(cleanProfile({ bike: 'toString' }).bike).toBe('allround');
  });
  it('clamps silly numbers and keeps good ones', () => {
    expect(cleanProfile({ riderKg: 900, bike: 'tt', units: 'imperial' })).toEqual({ riderKg: 200, bike: 'tt', units: 'imperial' });
    expect(cleanProfile({ riderKg: 'x' }).riderKg).toBe(72);
  });
  it('round-trips through storage', () => {
    const s = store();
    expect(saveProfile(s, { ...DEFAULT_PROFILE, riderKg: 64, bike: 'gravel' })).toBe(true);
    expect(loadProfile(s)).toMatchObject({ riderKg: 64, bike: 'gravel' });
    expect(bodyOf(loadProfile(s)).mass).toBeCloseTo(64 + BIKES.gravel.kg);
  });
});
