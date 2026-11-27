/* Other riders. Each bot is an ordinary rider (same physics, same drafting) with a small brain that sets its power
   and steering the way a person would: harder uphill, easing downhill, sitting on a wheel, pulling out to pass.
   Pacers hold a steady watts-per-kilo and lap the course for ever. */
import { createRider, stepRider, LANE, laneSign } from './rider.js';
import { gapAhead } from './draft.js';
import { bodyFor } from './profile.js';

export const PACERS = Object.freeze([
  { key: 'D', name: 'Pacer D', wkg: 1.5, kit: 'green' }, { key: 'C', name: 'Pacer C', wkg: 2.2, kit: 'blue' },
  { key: 'B', name: 'Pacer B', wkg: 3.0, kit: 'orange' }, { key: 'A', name: 'Pacer A', wkg: 4.0, kit: 'black' }]);
const NAMES = ['Ana', 'Ben', 'Carla', 'Dmitri', 'Elif', 'Femi', 'Greta', 'Hiro', 'Imani', 'Jonas', 'Keiko', 'Luca', 'Maya', 'Nico', 'Olga', 'Pablo', 'Quinn', 'Rosa', 'Sven', 'Tara', 'Uma', 'Viktor', 'Wen', 'Yusuf', 'Zoe'];
const KITS = ['red', 'blue', 'green', 'orange', 'white', 'black', 'purple', 'yellow'], SKIN_KEYS = ['light', 'medium', 'tan', 'dark'], BIKE_KEYS = ['allround', 'allround', 'climbing', 'aero'];

// rand: a function returning 0..1 (seeded, so a field of bots can be rebuilt the same)
export function createBots(line, { humans = 14, pacers = true, near = 0, rand = Math.random } = {}) {
  const bots = [], pick = a => a[Math.floor(rand() * a.length)], mirror = laneSign(line);
  const add = (spec, s, dir = 1) => {
    const body = bodyFor(spec.kg, spec.bike || 'allround');
    const r = createRider({ s, v: 6, power: spec.wkg * spec.kg * 0.7, lane: (-1.75 + (rand() - 0.5) * 0.8) * mirror, body });
    Object.assign(r, { dir, bot: { ...spec, home: r.lane, clock: rand() * 1000, phase: rand() * 6.28, surge: 0, nextSurge: 40 + rand() * 140, effort: 0.75 }, name: spec.name, character: spec.character, kit: spec.kit, kg: spec.kg, heightM: spec.heightM, skin: spec.skin, bike: spec.bike || 'allround' });
    if (dir < 0) r.lane = r.bot.home;
    bots.push(r); return r;
  };
  if (pacers) PACERS.forEach((p, i) => add({ ...p, pacer: true, bike: 'aero', character: i % 2 ? 'female' : 'male', kg: i % 2 ? 62 : 74, heightM: i % 2 ? 1.68 : 1.8, skin: SKIN_KEYS[i % 4] }, line.wrap(near + 60 + i * line.LEN / (PACERS.length + (line.closed ? 0 : 1)))));
  const used = new Set();
  for (let i = 0; i < humans; i++) {
    let name; do { name = pick(NAMES) + ' ' + String.fromCharCode(65 + Math.floor(rand() * 26)) + '.'; } while (used.has(name)); used.add(name);
    // people come in all sizes: a height, then a weight from a body-mass index between slight and heavy-set
    const character = rand() < 0.5 ? 'female' : 'male', heightM = character === 'female' ? 1.54 + rand() * 0.24 : 1.66 + rand() * 0.28;
    const bmi = 19.5 + rand() * rand() * 11, kg = bmi * heightM * heightM;
    // most start within a few hundred metres of the player; a few ride the course the other way
    const s = i < humans * 0.6 ? near + (rand() - 0.35) * 500 : rand() * line.LEN;
    add({ name, kg, heightM, skin: pick(SKIN_KEYS), wkg: Math.max(1.3, 1.7 + rand() * 2.2 - Math.max(0, bmi - 25) * 0.12), character, kit: pick(KITS), bike: pick(BIKE_KEYS) }, line.wrap(s), rand() < 0.2 ? -1 : 1);
  }
  return bots;
}

// nearest rider ahead of `me` going my way, within `reach` metres
function ahead(me, riders, course, reach) {
  let best = null, bg = reach;
  for (const o of riders) { if (o === me || o.dir !== me.dir) continue; const g = gapAhead(me, o, course); if (g > 0.2 && g < bg) { bg = g; best = o; } }
  return best ? { rider: best, gap: bg } : null;
}

/* Decide a bot's power and steering for the next instant, then move it. riders: everyone on the road. */
export function stepBot(r, riders, line, dt, opts) {
  const b = r.bot, slope = r.grade / 100, ftp = b.wkg * b.kg;
  b.clock += dt;
  let effort;
  if (b.pacer) effort = slope < -0.05 ? 0.6 : 1;                        // pacers hold their number, easing only on steep descents
  else {
    effort = 0.74 + 0.07 * Math.sin(b.clock / 23 + b.phase) + 0.04 * Math.sin(b.clock / 5.3 + b.phase * 2);
    if (slope > 0.02) effort *= 1 + Math.min(0.28, (slope - 0.02) * 3);  // people push on climbs
    if (slope < -0.03) effort *= slope < -0.06 ? 0 : 0.5;                 // and coast down the steep ones
    if (b.surge > 0) { b.surge -= dt; effort *= 1.4; }                    // now and then, a dig
    else if ((b.nextSurge -= dt) <= 0) { b.surge = 7 + (b.phase % 1) * 8; b.nextSurge = 60 + ((b.clock * 7.3) % 150); }
  }
  // the wheel in front: sit on it, or pull out and pass if clearly faster (lanes here are worked as if riders kept left)
  const a = ahead(r, riders, line, 9), mirror = laneSign(line);
  let want = b.home * mirror;
  if (a) {
    const closing = r.v - a.rider.v, side = Math.abs(a.rider.lane - r.lane), theirs = a.rider.lane * mirror;
    if (closing > 0.35 && a.gap < 7) want = Math.min(LANE.centre, theirs + 0.95);            // pass on the outside
    else if (a.gap < 5) { want = theirs; if (!b.pacer && a.gap < 2.6 && r.drag < 0.85) effort *= 0.86; }   // sheltered: ease off and sit in
    if (a.gap < 1.9 && side < 0.45 && closing > 0) r.v = Math.max(a.rider.v, r.v - 4 * dt);         // don't ride through them
  }
  b.effort += (effort - b.effort) * Math.min(1, dt * 0.8);
  r.target = ftp * b.effort;
  r.steer = Math.max(-1, Math.min(1, (want - r.lane * mirror) * 1.6)) * mirror;
  stepRider(r, line, dt, opts);
}
