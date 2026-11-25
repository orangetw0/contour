/* One rider on the road: the player today, bots later. State only; stepRider moves it along a course line. */
import { stepSpeed, REAL } from './physics.js';

export function createRider({ s = 0, v = 6, power = 220, lane = -1.75, body }) {
  return {
    s,                 // metres along the road
    v,                 // m/s
    power,             // watts reaching the pedals, eased toward target
    target: power,     // watts asked for: slider, keys or trainer
    dist: 0,           // metres ridden this visit
    time: 0,           // seconds ridden this visit
    lane,              // metres right of the centre line (negative: left)
    grade: 0,          // % gradient, eased, as shown and as sent to the trainer
    altitude: 0,       // metres
    hr: null,          // beats per minute, from a heart-rate monitor
    cadence: null,     // pedal revolutions per minute, from the trainer
    body,
    trainer: false,    // power is coming from a trainer
  };
}

/* Advance one rider by dt seconds along a course line (from buildLine).
   opts.model:  the physics rules (REAL unless told otherwise).
   opts.limits: from buildSpeedLimit; the rider brakes for bends.
   opts.cruise: hold this speed whatever the power (scenery mode). */
export function stepRider(r, line, dt, opts = {}) {
  const sc = line.scratch;
  r.power += (r.target - r.power) * Math.min(1, dt * 3);
  line.at(r.s, sc);
  const slope = sc.t.y, v = r.v;
  r.altitude = sc.p.y;
  r.v = stepSpeed(v, r.power, slope, r.body, dt, opts.model || REAL, { altitude: sc.p.y, vLimit: opts.limits ? opts.limits.at(r.s) : Infinity });
  if (opts.cruise != null) r.v = v + (opts.cruise - v) * Math.min(1, dt);
  r.s = (r.s + r.v * dt) % line.LEN;
  r.dist += r.v * dt;
  r.time += dt;
  r.grade += (slope * 100 - r.grade) * Math.min(1, dt * 2);
  return r;
}
