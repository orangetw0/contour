/* Running totals for a ride: work done, average power and speed, metres climbed, and power second by second
   (for normalised power). Pure sums; the display reads them. */
import { normalisedPower } from './metrics.js';

export function createTally() {
  const t = { joules: 0, moving: 0, dist: 0, ascent: 0, seconds: [], last: null, acc: 0, accT: 0 };
  return {
    // watts held for dt seconds, at speed v (m/s) and altitude (m)
    step(watts, v, altitude, dt) {
      t.joules += watts * dt;
      if (v > 0.5) { t.moving += dt; t.dist += v * dt; }
      if (t.last !== null && altitude > t.last && altitude - t.last < 5) t.ascent += altitude - t.last;      // a skip up the road is not a climb
      t.last = altitude;
      t.acc += watts * dt; t.accT += dt;
      if (t.accT >= 1) { t.seconds.push(t.acc / t.accT); t.acc = 0; t.accT = 0; if (t.seconds.length > 6 * 3600) t.seconds.shift(); }
    },
    get kj() { return t.joules / 1000; },
    get avgPower() { return t.moving > 0 ? t.joules / Math.max(t.moving, 1) : 0; },
    get avgSpeed() { return t.moving > 0 ? t.dist / t.moving : 0; },
    get ascent() { return t.ascent; },
    get np() { return normalisedPower(t.seconds); },
  };
}
