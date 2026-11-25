import { describe, it, expect } from 'vitest';
import { heartRate, crankData, cadenceBetween, indoorBikeCadence } from '../src/devices/sensors.js';

const dv = bytes => new DataView(Uint8Array.from(bytes).buffer);

describe('heart rate', () => {
  it('reads one-byte and two-byte values', () => {
    expect(heartRate(dv([0x00, 142]))).toBe(142);
    expect(heartRate(dv([0x01, 0x2C, 0x01]))).toBe(300);
    expect(heartRate(dv([0x16, 150, 1, 2, 3, 4]))).toBe(150);
  });
  it('returns null for a short message', () => { expect(heartRate(dv([0x00]))).toBe(null); expect(heartRate(dv([0x01, 5]))).toBe(null); });
});

describe('cadence', () => {
  it('finds crank data after the optional fields of a power measurement', () => {
    expect(crankData(dv([0x20, 0, 0xFA, 0, 0x10, 0x00, 0x00, 0x04]))).toEqual({ revs: 16, time: 1024 });
    // flags 0x35: balance, torque, wheel and crank data all present
    expect(crankData(dv([0x35, 0, 0xFA, 0, 50, 1, 2, 1, 2, 3, 4, 5, 6, 0x07, 0x00, 0x00, 0x08]))).toEqual({ revs: 7, time: 2048 });
    expect(crankData(dv([0x00, 0, 0xFA, 0]))).toBe(null);
  });
  it('turns two readings into rpm', () => {
    expect(cadenceBetween({ revs: 10, time: 0 }, { revs: 13, time: 2048 })).toBeCloseTo(90);
  });
  it('copes with both counters wrapping', () => {
    expect(cadenceBetween({ revs: 65535, time: 65024 }, { revs: 1, time: 1536 })).toBeCloseTo(60);
  });
  it('returns null when there has been no new turn', () => {
    expect(cadenceBetween({ revs: 5, time: 100 }, { revs: 5, time: 100 })).toBe(null);
    expect(cadenceBetween(null, { revs: 5, time: 100 })).toBe(null);
  });
  it('reads cadence from Indoor Bike Data', () => {
    expect(indoorBikeCadence(dv([0x44, 0x00, 0x10, 0x0E, 0xB4, 0x00, 0x2C, 0x01]))).toBe(90);
    expect(indoorBikeCadence(dv([0x40, 0x00, 0x10, 0x0E, 0x2C, 0x01]))).toBe(null);
  });
});
