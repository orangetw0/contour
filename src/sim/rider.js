/* One rider on the road: the player today, bots later. State only; stepRider moves it along a course line. */
import { stepSpeed, LEGACY } from './physics.js';

export function createRider({ s = 0, v = 6, power = 220, lane = -1.75, body }) {
  return {
    s,                 // metres along the road
    v,                 // m/s
    power,             // watts reaching the road, eased toward target
    target: power,     // watts asked for: slider, keys or trainer
    dist: 0,           // metres ridden this visit
    time: 0,           // seconds ridden this visit
    lane,              // metres right of the centre line (negative: left)
    grade: 0,          // % gradient, eased, as shown and as sent to the trainer
    body,
    trainer: false,    // power is coming from a trainer
  };
}

/* Advance one rider by dt seconds along a course line (from buildLine).
   opts.cruise: hold this speed whatever the power (scenery mode). opts.model: the physics rules. */
export function stepRider(r, line, dt, opts = {}) {
  const sc = line.scratch;
  r.power += (r.target - r.power) * Math.min(1, dt * 3);
  line.at(r.s, sc);
  const slope = sc.t.y, v = r.v;
  r.v = stepSpeed(v, r.power, slope, r.body, dt, opts.model || LEGACY);
  if (opts.cruise != null) r.v = v + (opts.cruise - v) * Math.min(1, dt);
  r.s = (r.s + r.v * dt) % line.LEN;
  r.dist += r.v * dt;
  r.time += dt;
  r.grade += (slope * 100 - r.grade) * Math.min(1, dt * 2);
  return r;
}
