import { describe, it, expect } from 'vitest';
import { buildLine, valleyControl } from '../src/course/line.js';
import { buildSpeedLimit } from '../src/course/speedLimit.js';
import { createRider, stepRider, LANE } from '../src/sim/rider.js';
import { draftOf, gapAhead, DRAFT } from '../src/sim/draft.js';
import { createBots, stepBot, PACERS } from '../src/sim/bots.js';
import { createChatter } from '../src/sim/chatter.js';
import { steadySpeed } from '../src/sim/physics.js';
import { bodyOf, DEFAULT_PROFILE } from '../src/sim/profile.js';

const line = buildLine(valleyControl()), limits = buildSpeedLimit(line), body = bodyOf(DEFAULT_PROFILE);
const seeded = (seed = 3) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const at = (s, lane = -1.75, v = 10, extra = {}) => Object.assign(createRider({ s, v, lane, body }), extra);

describe('drafting', () => {
  it('saves most on the wheel, less further back, nothing beyond reach', () => {
    const lead = at(100), on = draftOf(at(98), [lead], line.LEN).drag, back = draftOf(at(92), [lead], line.LEN).drag;
    expect(on).toBeCloseTo(1 - DRAFT.best * Math.exp(-0.3 / DRAFT.fade), 6);
    expect(back).toBeGreaterThan(on); expect(back).toBeLessThan(1);
    expect(draftOf(at(80), [lead], line.LEN).drag).toBe(1);
  });
  it('needs you to be behind, in line, and going the same way', () => {
    const lead = at(100);
    expect(draftOf(at(102), [lead], line.LEN).drag).toBe(1);
    expect(draftOf(at(98, -0.5), [lead], line.LEN).drag).toBe(1);
    expect(draftOf(at(98, -1.75, 10, { dir: -1 }), [lead], line.LEN).drag).toBe(1);
    expect(draftOf(at(98, -1.4), [lead], line.LEN).drag).toBeGreaterThan(draftOf(at(98), [lead], line.LEN).drag);
  });
  it('gives more shelter behind a bigger rider, and a little more in a group, up to a cap', () => {
    const small = at(100, -1.75, 10, { body: { ...body, cda: 0.26 } }), big = at(100, -1.75, 10, { body: { ...body, cda: 0.38 } });
    expect(draftOf(at(98), [big], line.LEN).drag).toBeLessThan(draftOf(at(98), [small], line.LEN).drag);
    const group = [at(100), at(102), at(104)];
    expect(draftOf(at(98), group, line.LEN).drag).toBeLessThan(draftOf(at(98), [group[0]], line.LEN).drag);
    expect(draftOf(at(98), [big, at(100), at(100.5)], line.LEN).drag).toBeGreaterThanOrEqual(1 - DRAFT.cap);
  });
  it('measures gaps across the start line and names who is giving the tow', () => {
    const lead = at(2, -1.75, 10, { name: 'lead' }), me = at(line.LEN - 1);
    expect(gapAhead(me, lead, line.LEN)).toBeCloseTo(3, 6);
    expect(draftOf(me, [lead], line.LEN).from).toBe(lead);
  });
  it('makes the same power faster', () => {
    expect(steadySpeed(220, 0, body, undefined, { drag: 0.7 })).toBeGreaterThan(steadySpeed(220, 0, body) + 1);
  });
});

describe('bots', () => {
  const field = () => createBots(line, { humans: 12, near: 500, rand: seeded() });
  const run = (bots, secs, extra = []) => { const all = [...bots, ...extra]; for (let i = 0; i < secs * 30; i++) { for (const r of all) r.drag = draftOf(r, all, line.LEN).drag; for (const b of bots) stepBot(b, all, line, 1 / 30, { limits }); } };
  it('builds four pacers and a named field, the same each time for the same seed', () => {
    const a = field(), b = field();
    expect(a.length).toBe(16); expect(a.filter(r => r.bot.pacer).map(r => r.name)).toEqual(PACERS.map(p => p.name));
    expect(new Set(a.map(r => r.name)).size).toBe(16);
    expect(a.map(r => [r.name, r.s, r.kit])).toEqual(b.map(r => [r.name, r.s, r.kit]));
    expect(a.some(r => r.dir === -1)).toBe(true);
  });
  it('keeps everyone moving, in their lane, with sane numbers', () => {
    const bots = field(); run(bots, 240);
    for (const r of bots) {
      expect(Number.isFinite(r.s) && Number.isFinite(r.v) && Number.isFinite(r.lane)).toBe(true);
      expect(r.dist).toBeGreaterThan(300); expect(r.lane).toBeGreaterThanOrEqual(LANE.edge); expect(r.lane).toBeLessThanOrEqual(LANE.centre);
      expect(r.target).toBeLessThan(r.bot.wkg * r.bot.kg * 1.9); expect(r.v).toBeLessThan(28);
    }
  });
  it('pacers hold their watts per kilo on the flat and climbs', () => {
    const bots = field().filter(r => r.bot.pacer); run(bots, 60);
    for (const r of bots) if (r.grade > -5) expect(r.power / r.bot.kg).toBeCloseTo(r.bot.wkg, 1);
  });
  it('a faster bot pulls out, passes a slower rider and does not ride through them', () => {
    const slow = at(300, -1.75, 5); slow.target = 90;
    const [fast] = createBots(line, { humans: 1, pacers: false, rand: seeded(9) });
    Object.assign(fast, { s: 280, lane: -1.75, v: 10, dir: 1 }); fast.bot.wkg = 4.5; fast.bot.home = -1.75;
    let minGapInLine = Infinity, pulledOut = false;
    for (let i = 0; i < 40 * 30; i++) {
      const all = [fast, slow]; fast.drag = draftOf(fast, all, line.LEN).drag;
      stepBot(fast, all, line, 1 / 30, { limits }); stepRider(slow, line, 1 / 30, { limits });
      const g = gapAhead(fast, slow, line.LEN);
      if (g < 20 && Math.abs(fast.lane - slow.lane) < 0.4) minGapInLine = Math.min(minGapInLine, g);
      if (fast.lane > slow.lane + 0.6) pulledOut = true;
    }
    expect(pulledOut).toBe(true); expect(minGapInLine).toBeGreaterThan(1.2);
    expect(gapAhead(slow, fast, line.LEN)).toBeLessThan(line.LEN / 2);          // the fast one is now in front
  });
});

describe('chatter', () => {
  const speakers = [{ name: 'Ana B.', grade: 6, drag: 1, draftFrom: null }, { name: 'Luca R.', grade: 0, drag: 0.75, draftFrom: 'Ana B.' }, { name: 'Pacer C', grade: 0, drag: 1, pacer: true, wkg: 2.2 }];
  it('opens with a greeting, then talks at a human pace with filled-in names', () => {
    const chat = createChatter({ rand: seeded(5) }), all = [];
    for (let t = 0; t < 600; t += 0.5) all.push(...chat.step(0.5, speakers));
    expect(all.length).toBeGreaterThan(10); expect(all.length).toBeLessThan(60);
    for (const m of all) { expect(speakers.some(s => s.name === m.name)).toBe(true); expect(m.text).not.toMatch(/[{}]/); expect(m.text.length).toBeGreaterThan(2); }
    expect(all.some(m => /2\.2 w\/kg/.test(m.text))).toBe(true);
  });
  it('stays quiet when nobody is near', () => {
    const chat = createChatter({ rand: seeded(5) }); let n = 0;
    for (let t = 0; t < 300; t += 0.5) n += chat.step(0.5, []).length;
    expect(n).toBe(0);
  });
});
