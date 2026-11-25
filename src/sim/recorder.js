/* Ride recorder: one sample a second of simulated time while the rider is moving or pedalling.
   Samples are plain SI values; export (src/export/fit.js) turns them into a file. */
import { normalisedPower } from './metrics.js';

export function createRecorder({ startUnix, geo = null }) {
  const samples = [];
  let acc = 0;
  // local metres to latitude and longitude, where the course knows where on Earth it is
  const place = geo ? (x, z) => [geo.lat0 + geo.m[0] * x + geo.m[1] * z, geo.lon0 + geo.m[2] * x + geo.m[3] * z] : () => [null, null];
  return {
    samples, startUnix,
    // call every simulation step, after the rider has moved; pos is the rider's place on the road
    step(rider, pos, dt) {
      acc += dt;
      if (acc < 1) return;
      acc -= 1;
      if (rider.v < 0.3 && rider.target < 1) return;                 // stopped: the timer pauses
      const [lat, lon] = place(pos.x, pos.z);
      samples.push({ t: startUnix + Math.round(rider.time), lat, lon, alt: pos.y, dist: rider.dist, v: rider.v,
        power: Math.max(0, Math.round(rider.target)), hr: rider.hr, cad: rider.cadence });
    },
    summary() {
      const n = samples.length;
      if (!n) return null;
      const avg = k => { const xs = samples.map(s => s[k]).filter(x => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
      const max = k => { const xs = samples.map(s => s[k]).filter(x => x != null); return xs.length ? Math.max(...xs) : null; };
      let ascent = 0, ref = samples[0].alt;                           // count a climb only once it passes 1 m, so ripples don't add up
      for (const s of samples) { if (s.alt > ref + 1) { ascent += s.alt - ref; ref = s.alt; } else if (s.alt < ref) ref = s.alt; }
      return {
        start: samples[0].t, end: samples[n - 1].t, elapsed: samples[n - 1].t - samples[0].t + 1, moving: n,
        distance: samples[n - 1].dist - samples[0].dist + samples[0].v, ascent,
        avgSpeed: avg('v'), maxSpeed: max('v'), avgPower: avg('power'), maxPower: max('power'), np: normalisedPower(samples.map(s => s.power)),
        avgHr: avg('hr'), maxHr: max('hr'), avgCad: avg('cad'),
        work: samples.reduce((a, s) => a + s.power, 0) / 1000,       // kJ: one sample is one second
      };
    },
  };
}
