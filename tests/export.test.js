import { describe, it, expect } from 'vitest';
import { Decoder, Stream } from '@garmin/fitsdk';
import { encodeFit } from '../src/export/fit.js';
import { createRecorder } from '../src/sim/recorder.js';
import { createRider, stepRider } from '../src/sim/rider.js';
import { createRolling, normalisedPower, wattsPerKg } from '../src/sim/metrics.js';
import { buildLine, valleyControl, mkPose } from '../src/course/line.js';
import { buildSpeedLimit } from '../src/course/speedLimit.js';
import { bodyOf, DEFAULT_PROFILE } from '../src/sim/profile.js';

const line = buildLine(valleyControl()), limits = buildSpeedLimit(line), body = bodyOf(DEFAULT_PROFILE);
const geo = { lat0: 51.86838851, lon0: -2.06472819, m: [8.022164866896388e-09, -8.99089043232476e-06, 1.4523536029963424e-05, 1.2958788745233258e-08] };

function ride(seconds, { withGeo = true, hr = 140, cadence = 88 } = {}) {
  const r = createRider({ body }), rec = createRecorder({ startUnix: 1795564800, geo: withGeo ? geo : null }), pose = mkPose();
  r.hr = hr; r.cadence = cadence;
  for (let i = 0; i < seconds * 60; i++) { stepRider(r, line, 1 / 60, { limits }); rec.step(r, line.at(r.s, pose).p, 1 / 60); }
  return { r, rec };
}

describe('metrics', () => {
  it('averages the last three seconds', () => {
    const a = createRolling(3, 60);
    for (let i = 0; i < 180; i++) a.push(100);
    for (let i = 0; i < 90; i++) a.push(300);
    expect(a.avg).toBeCloseTo(200, 6);
    for (let i = 0; i < 90; i++) a.push(300);
    expect(a.avg).toBeCloseTo(300, 6);
  });
  it('averages what it has before the window fills', () => { expect(createRolling(3, 60).push(250).avg).toBe(250); });
  it('gives watts per kilo of rider', () => { expect(wattsPerKg(288, 72)).toBe(4); });
  it('normalised power equals average for a steady ride and is higher for a surging one', () => {
    expect(normalisedPower(new Array(600).fill(200))).toBeCloseTo(200, 6);
    const surgy = Array.from({ length: 600 }, (_, i) => Math.floor(i / 60) % 2 ? 300 : 100);
    expect(normalisedPower(surgy)).toBeGreaterThan(210);
    expect(normalisedPower([200, 200])).toBe(null);
  });
});

describe('recorder', () => {
  it('takes one sample a second with position, power, heart rate and cadence', () => {
    const { r, rec } = ride(120);
    expect(rec.samples.length).toBe(120);
    const s = rec.samples[60];
    expect(s.t - rec.samples[59].t).toBe(1);
    expect(s.lat).toBeGreaterThan(51.85); expect(s.lat).toBeLessThan(51.89); expect(s.lon).toBeGreaterThan(-2.09); expect(s.lon).toBeLessThan(-2.04);
    expect(s).toMatchObject({ power: 220, hr: 140, cad: 88 });
    const sum = rec.summary();
    expect(sum.moving).toBe(120); expect(sum.avgPower).toBe(220);
    expect(sum.distance).toBeGreaterThan(r.dist * 0.97); expect(sum.distance).toBeLessThanOrEqual(r.dist + 1);
    expect(sum.work).toBeCloseTo(26.4, 6);
  });
  it('pauses while the rider is stopped', () => {
    const r = createRider({ body, v: 0, power: 0 }), rec = createRecorder({ startUnix: 0 }), pose = mkPose();
    const flat = { ...line, at: (s, o) => { line.at(s, o); o.t.set(1, 0, 0); return o; }, scratch: mkPose() };
    for (let i = 0; i < 600; i++) { stepRider(r, flat, 1 / 60); rec.step(r, pose.p, 1 / 60); }
    expect(rec.samples.length).toBe(0); expect(rec.summary()).toBe(null);
  });
});

describe('FIT export', () => {
  const decode = bytes => { const st = Stream.fromByteArray(Array.from(bytes)); const d = new Decoder(st); expect(d.isFIT()).toBe(true); expect(d.checkIntegrity()).toBe(true); return d.read(); };
  it('writes a file the Garmin FIT SDK reads back', () => {
    const { rec } = ride(300), sum = rec.summary(), { messages, errors } = decode(encodeFit(rec.samples, sum));
    expect(errors).toEqual([]);
    expect(messages.fileIdMesgs[0].type).toBe('activity');
    expect(messages.recordMesgs.length).toBe(300);
    const a = rec.samples[150], b = messages.recordMesgs[150];
    expect(b.timestamp.getTime() / 1000).toBe(a.t);
    expect(b.positionLat * (180 / 2 ** 31)).toBeCloseTo(a.lat, 6);
    expect(b.positionLong * (180 / 2 ** 31)).toBeCloseTo(a.lon, 6);
    expect(b.altitude).toBeCloseTo(a.alt, 0);
    expect(b.speed).toBeCloseTo(a.v, 2);
    expect(b.distance).toBeCloseTo(a.dist - (rec.samples[0].dist - rec.samples[0].v), 1);
    expect(b).toMatchObject({ power: 220, heartRate: 140, cadence: 88 });
    const s = messages.sessionMesgs[0];
    expect(s.sport).toBe('cycling'); expect(s.subSport).toBe('virtualActivity');
    expect(s.totalTimerTime).toBe(300); expect(s.totalDistance).toBeCloseTo(sum.distance, 1);
    expect(s.avgPower).toBe(220); expect(s.avgHeartRate).toBe(140); expect(s.totalAscent).toBe(Math.round(sum.ascent));
    expect(messages.lapMesgs.length).toBe(1); expect(messages.activityMesgs[0].numSessions).toBe(1);
    expect(messages.eventMesgs.map(e => e.eventType)).toEqual(['start', 'stopAll']);
  });
  it('leaves out position, heart rate and cadence when there are none', () => {
    const { rec } = ride(60, { withGeo: false, hr: null, cadence: null });
    const { messages, errors } = decode(encodeFit(rec.samples, rec.summary()));
    expect(errors).toEqual([]);
    const b = messages.recordMesgs[30];
    expect(b.positionLat).toBeUndefined(); expect(b.heartRate).toBeUndefined(); expect(b.cadence).toBeUndefined();
    expect(b.power).toBe(220);
    expect(messages.sessionMesgs[0].avgHeartRate).toBeUndefined();
  });
  it('refuses an empty ride', () => { expect(() => encodeFit([], null)).toThrow(); });
});
