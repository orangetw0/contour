import { describe, it, expect } from 'vitest';
import { acceleration, stepSpeed, steadySpeed, LEGACY, G } from '../src/sim/physics.js';
import { bodyOf, DEFAULT_PROFILE, cleanProfile, loadProfile, saveProfile } from '../src/sim/profile.js';

const body = bodyOf(DEFAULT_PROFILE);

describe('physics (legacy model)', () => {
  it('default profile is the original 80 kg, CdA 0.32, Crr 0.004', () => {
    expect(body).toEqual({ mass: 80, cda: 0.32, crr: 0.004 });
  });
  it('matches the original force formula', () => {
    const v = 8, p = 220, slope = 0.05;
    const force = p / v - 80 * 9.81 * (slope + 0.004) - 0.5 * 1.2 * 0.32 * v * v;
    expect(acceleration(v, p, slope, body)).toBeCloseTo(force / 80, 12);
  });
  it('descents count half and the brakes come on above 54 km/h', () => {
    const v = 18, slope = -0.08;
    const force = 0 / v - 80 * G * (slope * 0.5 + 0.004) - 0.5 * 1.2 * 0.32 * v * v - 80 * 0.5 * (v - 15);
    expect(acceleration(v, 0, slope, body)).toBeCloseTo(force / 80, 12);
  });
  it('200 W on the flat settles near 34.5 km/h', () => {
    const kmh = steadySpeed(200, 0, body) * 3.6;
    expect(kmh).toBeGreaterThan(34); expect(kmh).toBeLessThan(35);
  });
  it('climbing is slower, and more power is faster', () => {
    expect(steadySpeed(250, 0.08, body)).toBeLessThan(steadySpeed(250, 0, body));
    expect(steadySpeed(300, 0.05, body)).toBeGreaterThan(steadySpeed(200, 0.05, body));
  });
  it('a heavier rider climbs slower at the same power', () => {
    expect(steadySpeed(250, 0.08, { ...body, mass: 95 })).toBeLessThan(steadySpeed(250, 0.08, body));
  });
  it('steady climbing speed balances power against gravity, rolling and drag', () => {
    const v = steadySpeed(250, 0.08, body);
    expect(v * (80 * G * (0.08 + 0.004) + 0.5 * 1.2 * 0.32 * v * v)).toBeCloseTo(250, 2);
  });
  it('never drops below the minimum speed', () => {
    expect(stepSpeed(0.5, 0, 0.2, body, 0.1)).toBe(LEGACY.minSpeed);
  });
  it('a coasting descent stays below 80 km/h', () => {
    expect(steadySpeed(0, -0.12, body) * 3.6).toBeLessThan(80);
  });
});

describe('profile', () => {
  const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v) }; };
  it('falls back to defaults on junk', () => {
    expect(cleanProfile('nope')).toEqual(DEFAULT_PROFILE);
    expect(loadProfile({ getItem: () => '{bad json' })).toEqual(DEFAULT_PROFILE);
    expect(loadProfile({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_PROFILE);
  });
  it('clamps silly numbers and keeps good ones', () => {
    const p = cleanProfile({ riderKg: 900, bikeKg: 7.2, cda: 'x', units: 'imperial' });
    expect(p).toMatchObject({ riderKg: 200, bikeKg: 7.2, cda: 0.32, units: 'imperial' });
  });
  it('round-trips through storage', () => {
    const s = store();
    expect(saveProfile(s, { ...DEFAULT_PROFILE, riderKg: 64 })).toBe(true);
    expect(loadProfile(s).riderKg).toBe(64);
  });
});
