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
    lane,              // metres right of the centre line, as the rider sees it (negative: left); which side riders keep to is the course's line.keep

    dir: 1,            // +1 riding the course forwards, -1 back the other way
    steer: 0,          // -1 (left) to 1 (right), from the keys or a steering device
    slide: 0,          // sideways speed, m/s, for the picture
    uturn: 0,          // 1 just after a U-turn, easing to 0 as the rider comes round
    loop: 0,           // on a turning loop beyond an end of an open road: 1 the far end, -1 the start, 0 on the road
    turns: 0,          // how many times the rider has ridden off an end of the road into its turning loop
    turnEnd: null,     // which end the latest of those was: 1 the far end, 0 the start
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
  const next = r.s + r.dir * r.v * dt, turn = line.closed === false ? line.turn : null;
  if (turn) {
    // an open road: off the end the rider goes round the turning loop, and comes back onto the road heading the other way
    const far = line.LEN + turn.len, round = next >= far || next <= -turn.len;
    const loop = round ? 0 : next > line.LEN ? 1 : next < 0 ? -1 : 0, end = next > line.LEN ? 1 : 0;
    if ((loop || round) && !r.loop) { r.turns++; r.turnEnd = end; }
    if (round) { r.s = end ? Math.max(0, line.LEN - (next - far)) : Math.min(line.LEN, -turn.len - next); r.dir = end ? -1 : 1; r.grade = -r.grade; }
    else r.s = next;
    r.loop = loop;
  } else r.s = line.wrap ? line.wrap(next) : ((next % line.LEN) + line.LEN) % line.LEN;
  steerRider(r, dt, line.keep > 0 ? -1 : 1);
  r.dist += r.v * dt;
  r.time += dt;
  r.grade += (slope * 100 - r.grade) * Math.min(1, dt * 2);
  return r;
}

// The rider's own lane: from just inside the road's edge to just short of the centre line. These are for a course
// where riders keep left; where they keep right the lane is the mirror image (0.3 to 3.2).
export const LANE = Object.freeze({ edge: -3.2, centre: -0.3 });
// +1 where riders keep left, -1 where they keep right: multiply a lane by it to get the keep-left figure, or back again
export const laneSign = line => line.keep > 0 ? -1 : 1;

// mirror: laneSign of the course. The sums are done as if riders kept left.
function steerRider(r, dt, mirror) {
  const rate = Math.min(2.2, 0.6 + 0.12 * r.v);                    // sideways speed grows with road speed
  let slide = r.steer * mirror * rate;
  const before = r.lane * mirror;
  if (before > LANE.centre) slide = Math.min(slide, -1.6);          // on the wrong side (after a U-turn): cross back
  const lane = Math.max(LANE.edge, Math.min(Math.max(LANE.centre, before), before + slide * dt));
  r.lane = lane * mirror;
  r.slide = (lane - before) * mirror / dt;
  if (r.uturn > 0) r.uturn = Math.max(0, r.uturn - dt / 1.6);
}

// Turn round and ride back the other way. The rider slows, swings across the road and settles on the other side.
// Not on a turning loop: that is already taking them round.
export function uTurn(r) {
  if (r.uturn > 0 || r.loop) return false;
  r.dir = -r.dir; r.lane = -r.lane; r.grade = -r.grade;
  r.v = Math.min(r.v, 2.5); r.uturn = 1;
  return true;
}
