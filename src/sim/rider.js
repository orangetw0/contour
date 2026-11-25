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
    lane,              // metres right of the centre line, as the rider sees it (negative: left; riders keep left)
    dir: 1,            // +1 riding the course forwards, -1 back the other way
    steer: 0,          // -1 (left) to 1 (right), from the keys or a steering device
    slide: 0,          // sideways speed, m/s, for the picture
    uturn: 0,          // 1 just after a U-turn, easing to 0 as the rider comes round
    drag: 1,           // share of air drag left when drafting (1: clean air)
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
  const slope = sc.t.y * r.dir, v = r.v;
  r.altitude = sc.p.y;
  r.v = stepSpeed(v, r.power, slope, r.body, dt, opts.model || REAL, { altitude: sc.p.y, drag: r.drag, vLimit: opts.limits ? opts.limits.at(r.s, r.dir) : Infinity });
  if (opts.cruise != null) r.v = v + (opts.cruise - v) * Math.min(1, dt);
  r.s = (((r.s + r.dir * r.v * dt) % line.LEN) + line.LEN) % line.LEN;
  steerRider(r, dt);
  r.dist += r.v * dt;
  r.time += dt;
  r.grade += (slope * 100 - r.grade) * Math.min(1, dt * 2);
  return r;
}

// The rider's own lane: from just inside the road's edge to just short of the centre line.
export const LANE = Object.freeze({ edge: -3.2, centre: -0.3 });

function steerRider(r, dt) {
  const rate = Math.min(2.2, 0.6 + 0.12 * r.v);                    // sideways speed grows with road speed
  let slide = r.steer * rate;
  if (r.lane > LANE.centre) slide = Math.min(slide, -1.6);          // on the wrong side (after a U-turn): cross back
  const before = r.lane;
  r.lane = Math.max(LANE.edge, Math.min(Math.max(LANE.centre, before), before + slide * dt));
  r.slide = (r.lane - before) / dt;
  if (r.uturn > 0) r.uturn = Math.max(0, r.uturn - dt / 1.6);
}

// Turn round and ride back the other way. The rider slows, swings across the road and settles on the other side.
export function uTurn(r) {
  if (r.uturn > 0) return false;
  r.dir = -r.dir; r.lane = -r.lane; r.grade = -r.grade;
  r.v = Math.min(r.v, 2.5); r.uturn = 1;
  return true;
}
