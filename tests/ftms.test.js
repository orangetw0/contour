import { describe, it, expect } from 'vitest';
import { cyclingPower, indoorBikePower, trainerGrade, simParams, OP_SIM } from '../src/devices/ftms.js';

const dv = bytes => new DataView(Uint8Array.from(bytes).buffer);

describe('trainer messages', () => {
  it('reads power from a Cycling Power measurement', () => {
    expect(cyclingPower(dv([0x00, 0x00, 0xFA, 0x00]))).toBe(250);
    expect(cyclingPower(dv([0x00]))).toBe(null);
  });
  it('reads power from Indoor Bike Data with speed and cadence in front', () => {
    // flags 0x0044: cadence + power; speed present because bit 0 is clear
    expect(indoorBikePower(dv([0x44, 0x00, 0x10, 0x0E, 0xB4, 0x00, 0x2C, 0x01]))).toBe(300);
  });
  it('skips the optional fields in order', () => {
    // flags 0x0075: no speed, cadence, distance (3 bytes), resistance, power
    expect(indoorBikePower(dv([0x75, 0x00, 0xB4, 0x00, 1, 2, 3, 0x05, 0x00, 0xC8, 0x00]))).toBe(200);
  });
  it('returns null when the message has no power or is cut short', () => {
    expect(indoorBikePower(dv([0x04, 0x00, 0x10, 0x0E, 0xB4, 0x00]))).toBe(null);
    expect(indoorBikePower(dv([0x44, 0x00, 0x10, 0x0E, 0xB4, 0x00, 0x2C]))).toBe(null);
  });
  it('scales the gradient the trainer feels', () => {
    expect(trainerGrade(10, 0.5)).toBe(5);
    expect(trainerGrade(-10, 0.5)).toBe(-2.5);
    expect(trainerGrade(35, 1)).toBe(20);
    expect(trainerGrade(8, 0)).toBe(0);
  });
  it('packs simulation parameters as the original did', () => {
    const d = simParams(5.25, { mass: 80, cda: 0.32, crr: 0.004 });
    expect(d.getUint8(0)).toBe(OP_SIM);
    expect(d.getInt16(1, true)).toBe(0);
    expect(d.getInt16(3, true)).toBe(525);
    expect(d.getUint8(5)).toBe(40);
    expect(d.getUint8(6)).toBe(19);
    expect(simParams(-3, { cda: 0.32, crr: 0.004 }).getInt16(3, true)).toBe(-300);
  });
});
