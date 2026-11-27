import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseGpx } from '../src/course/gpx.js';
import { buildRoute, packRoute, unpackRoute, MAX_EXTENT } from '../src/course/route.js';
import { generateTerrain } from '../src/course/terrainGen.js';
import { buildLine, mkPose, turnShape } from '../src/course/line.js';
import { buildSpeedLimit } from '../src/course/speedLimit.js';
import { listImported, saveImported, loadImported, deleteImported, BUILT_IN } from '../src/course/library.js';
import { createRider, stepRider, uTurn } from '../src/sim/rider.js';
import { gapAhead, draftOf } from '../src/sim/draft.js';
import { createBots, stepBot } from '../src/sim/bots.js';
import { bodyOf, DEFAULT_PROFILE } from '../src/sim/profile.js';
import { makeClimb, climbGpx } from './fixtures/climb.js';

const body = bodyOf(DEFAULT_PROFILE);
const lineOf = (route, keep = -1) => buildLine(route.road.map(p => new THREE.Vector3(...p)), { closed: route.closed, keep });

describe('GPX', () => {
  it('reads track points, heights and the name', () => {
    const g = parseGpx(climbGpx());
    expect(g.name).toBe('Test climb'); expect(g.points.length).toBeGreaterThan(300);
    expect(g.points[0]).toMatchObject({ lat: expect.any(Number), lon: expect.any(Number), ele: expect.any(Number) });
  });
  it('reads route points, self-closing points and fills a missing height', () => {
    const g = parseGpx('<gpx><rte><name><![CDATA[Loop]]></name><rtept lat="1" lon="2"><ele>10</ele></rtept><rtept lon="2.001" lat="1.001"/><rtept lat="1.002" lon="2.002"><ele>30</ele></rtept></rte></gpx>');
    expect(g.name).toBe('Loop'); expect(g.points.map(p => p.ele)).toEqual([10, 10, 30]); expect(g.points[1].lat).toBe(1.001);
  });
  it('explains what is wrong with files it cannot use', () => {
    expect(() => parseGpx('<html>not a route</html>')).toThrow(/No track/);
    expect(() => parseGpx('<gpx><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2"/></gpx>')).toThrow(/no heights/);
  });
});

describe('building a route', () => {
  const src = makeClimb(), route = buildRoute(src, { name: 'Test climb' });
  it('measures it: about 6 km and 480 m of climbing, open-ended', () => {
    expect(route.closed).toBe(false);
    expect(route.length / 1000).toBeGreaterThan(5.5); expect(route.length / 1000).toBeLessThan(7);
    expect(route.ascent).toBeGreaterThan(440); expect(route.ascent).toBeLessThan(520); expect(route.descent).toBeLessThan(25);
  });
  it('spaces points evenly and keeps gradients rideable after smoothing out noisy heights', () => {
    let worst = 0;
    for (let i = 1; i < route.road.length; i++) {
      const a = route.road[i - 1], b = route.road[i], d = Math.hypot(b[0] - a[0], b[2] - a[2]);
      expect(d).toBeGreaterThan(9); expect(d).toBeLessThan(16);
      worst = Math.max(worst, Math.abs(b[1] - a[1]) / d);
    }
    expect(worst).toBeLessThan(0.2);                               // the fixture climbs at about 8 % with 3 m of noise on every point
  });
  it('can turn its metres back into latitude and longitude', () => {
    const [x, , z] = route.road[0], g = route.geo;
    expect(g.lat0 + g.m[0] * x + g.m[1] * z).toBeCloseTo(src[0].lat, 4); expect(g.lon0 + g.m[2] * x + g.m[3] * z).toBeCloseTo(src[0].lon, 4);
  });
  it('recognises a loop', () => {
    const loop = Array.from({ length: 200 }, (_, i) => ({ lat: 45 + 0.01 * Math.sin(i / 199 * 2 * Math.PI), lon: 6 + 0.014 * Math.cos(i / 199 * 2 * Math.PI), ele: 500 + 40 * Math.sin(i / 199 * 4 * Math.PI) }));
    expect(buildRoute(loop).closed).toBe(true);
  });
  it('refuses routes that are too short or too spread out, saying why', () => {
    expect(() => buildRoute([{ lat: 45, lon: 6, ele: 1 }, { lat: 45.0005, lon: 6, ele: 2 }])).toThrow(/shorter/);
    expect(() => buildRoute([{ lat: 45, lon: 6, ele: 1 }, { lat: 45.5, lon: 6, ele: 2 }])).toThrow(RangeError);
    expect(buildRoute([{ lat: 45, lon: 6, ele: 1 }, { lat: 45.15, lon: 6, ele: 2 }]).extent).toBeGreaterThan(16000);
    expect(MAX_EXTENT).toBe(25000);
  });
  it('survives being packed for storage and rebuilt', () => {
    const packed = packRoute('Test climb', route), again = unpackRoute(JSON.parse(JSON.stringify(packed)));
    expect(packed.km).toBeCloseTo(route.length / 1000, 1); expect(again.closed).toBe(false);
    expect(Math.abs(again.length - route.length)).toBeLessThan(25); expect(Math.abs(again.ascent - route.ascent)).toBeLessThan(15);
    expect(again.road.length).toBe(route.road.length);
  });
});

describe('invented terrain', () => {
  const route = buildRoute(makeClimb()), t = generateTerrain(route.road), w = t.cells + 1;
  const heightAt = (x, z) => { const f = v => Math.round((v + t.size / 2) / (t.size / t.cells)); return t.h[f(z) * w + f(x)]; };
  it('covers the route with room to spare, on a grid the ride can build', () => {
    expect(t.size).toBeGreaterThan(route.extent + 1500); expect(t.cells).toBeLessThanOrEqual(660); expect(t.h.length).toBe(w * w);
    for (const [x, , z] of route.road) { expect(Math.abs(x)).toBeLessThan(t.size / 2 - 600); expect(Math.abs(z)).toBeLessThan(t.size / 2 - 600); }
  });
  it('agrees with the road where the road goes', () => {
    let worst = 0, sum = 0;
    for (const [x, y, z] of route.road) { const d = Math.abs(heightAt(x, z) - y); worst = Math.max(worst, d); sum += d; }
    expect(sum / route.road.length).toBeLessThan(1.5); expect(worst).toBeLessThan(5);
  });
  it('lies level with the road for some metres either side, so nothing buries it', () => {
    for (let i = 5; i < route.road.length - 5; i += 3) {
      const [x, y, z] = route.road[i], [ax, , az] = route.road[i + 1], l = Math.hypot(ax - x, az - z), nx = -(az - z) / l, nz = (ax - x) / l;
      for (const off of [-12, 12]) expect(Math.abs(heightAt(x + nx * off, z + nz * off) - y)).toBeLessThan(4);
    }
  });
  it('has no holes or spikes', () => {
    for (let i = 0; i < t.h.length; i += 97) expect(Number.isFinite(t.h[i])).toBe(true);
    expect(t.demMax - t.demMin).toBeLessThan(1500); expect(t.demMin).toBeGreaterThan(route.low - 600);
  });
});

describe('open-ended roads', () => {
  const route = buildRoute(makeClimb()), line = lineOf(route), limits = buildSpeedLimit(line), turn = line.turn, far = line.LEN + turn.len;
  it('have two ends, with a turning loop beyond each', () => {
    expect(line.closed).toBe(false); expect(line.wrap(-5)).toBe(-5); expect(line.wrap(-1e5)).toBe(-turn.len); expect(line.wrap(line.LEN + 1e5)).toBe(far);
    expect(line.at(line.LEN, mkPose()).p.distanceTo(line.P[line.N - 1])).toBeLessThan(1e-3);
    expect(line.at(0, mkPose()).p.distanceTo(line.P[0])).toBeLessThan(1e-3);
    expect(line.apart(10, line.LEN - 10)).toBeCloseTo(line.LEN - 20, 3);
    expect(line.P[0].distanceTo(line.P[line.N - 1])).toBeGreaterThan(500);
    expect(turn.len).toBeGreaterThan(30); expect(turn.len).toBeLessThan(80); expect(turn.ends.length).toBe(2);
  });
  it('the loop is a smooth path that leaves the end, rounds the island and comes back to the same end reversed', () => {
    const shape = turnShape(), a = shape.local(0, {}), b = shape.local(shape.len, {});
    expect([a.x, a.y, a.a]).toEqual([0, 0, 0]); expect(b.x).toBeCloseTo(0, 9); expect(b.y).toBeCloseTo(0, 9); expect(b.a).toBeCloseTo(Math.PI, 9);
    const top = shape.local(shape.half, {}); expect(top.x).toBeCloseTo(shape.centre + shape.radius, 6); expect(top.y).toBeCloseTo(0, 6);
    for (const [end, sign] of [[line.LEN, 1], [0, -1]]) {
      const tip = line.P[sign > 0 ? line.N - 1 : 0], c = turn.ends[sign > 0 ? 1 : 0].c, here = mkPose(), next = mkPose();
      expect(c.distanceTo(tip)).toBeCloseTo(turn.centre, 6);
      for (let u = 0; u < turn.len + 30; u += 0.25) {             // on past the loop it carries on back down the road, still reversed
        line.at(end + sign * u, here); line.at(end + sign * (u + 0.25), next);
        expect(here.p.distanceTo(next.p)).toBeLessThan(0.2501); expect(here.p.distanceTo(next.p)).toBeGreaterThan(0.2);
        expect(here.t.angleTo(next.t)).toBeLessThan(0.07); expect(here.t.length()).toBeCloseTo(1, 6); expect(here.t.dot(here.r)).toBeCloseTo(0, 6);
        if (u > turn.stem + 1 && u < turn.len - turn.stem - 1) expect(Math.hypot(here.p.x - c.x, here.p.z - c.z)).toBeGreaterThan(turn.radius - 1e-6);
        if (u <= turn.len) expect(here.p.y).toBeCloseTo(tip.y, 6);
      }
      const back = line.at(end + sign * turn.len, mkPose()), out = line.at(end, mkPose());
      expect(back.p.distanceTo(tip)).toBeLessThan(1e-6); expect(back.t.x).toBeCloseTo(-out.t.x, 2); expect(back.t.z).toBeCloseTo(-out.t.z, 2);
    }
  });
  it('counts as road: nothing should be planted on it', () => {
    const c = turn.ends[1].c, n = line.nearRoad(c.x + turn.radius, c.z);
    expect(n.d).toBeLessThan(1.6); expect(n.y).toBe(line.P[line.N - 1].y); expect(n.i).toBe(line.N - 1);
  });
  it('slow riders for the turn at each end', () => {
    const round = Math.sqrt(4 * (turn.radius + 1.75));
    expect(limits.at(line.LEN, 1)).toBeLessThanOrEqual(round + 1e-6); expect(limits.at(0, -1)).toBeLessThanOrEqual(round + 1e-6); expect(limits.at(line.LEN + 20, 1)).toBeCloseTo(round, 6);
    expect(round).toBeGreaterThan(3); expect(round).toBeLessThan(7);
    expect(limits.at(line.LEN - 40, 1)).toBeLessThan(17); expect(limits.at(line.LEN / 2, 1)).toBeGreaterThan(5);
  });
  // where the rider is drawn: the line's pose, moved sideways into their lane
  const drawn = (r, pose = mkPose()) => { line.at(r.s, pose); return { p: pose.p.clone().addScaledVector(pose.r, r.dir * r.lane), heading: pose.t.clone().multiplyScalar(r.dir) }; };
  for (const keep of [-1, 1]) it(`a rider reaching the end rides round the island and comes back on their own side (keeping ${keep > 0 ? 'right' : 'left'})`, () => {
    const side = lineOf(route, keep), lim = buildSpeedLimit(side), c = side.turn.ends[1].c;
    const r = createRider({ body, s: side.LEN - 60, v: 6, lane: 1.75 * keep }); let last = null, sweep = 0, onLoop = 0, d0 = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const before = r.dir;
      stepRider(r, side, 1 / 60, { limits: lim });
      const pose = mkPose(); side.at(r.s, pose);
      const now = { p: pose.p.clone().addScaledVector(pose.r, r.dir * r.lane), heading: pose.t.clone().multiplyScalar(r.dir) };
      expect(r.s).toBeGreaterThanOrEqual(-side.turn.len); expect(r.s).toBeLessThanOrEqual(side.LEN + side.turn.len);
      if (last) {                                                   // no jump and no spin, least of all at the moment the ride reverses
        expect(now.p.distanceTo(last.p)).toBeLessThan(r.v / 60 * 1.6 + 0.02); expect(now.heading.angleTo(last.heading)).toBeLessThan(0.06);
        sweep += (last.heading.z * now.heading.x - last.heading.x * now.heading.z);
      }
      if (r.loop) { onLoop++; expect(r.v).toBeLessThan(5.5); expect(r.turns).toBe(1); expect(r.turnEnd).toBe(1); if (!d0) d0 = r.dist; }
      if (r.loop && r.s > side.LEN + side.turn.stem + 1 && r.s < side.LEN + side.turn.len - side.turn.stem - 1) expect(Math.hypot(now.p.x - c.x, now.p.z - c.z)).toBeGreaterThan(side.turn.radius + 0.25);    // outside the island, all the way round
      if (before !== r.dir) expect(r.loop).toBe(0);
      last = now;
    }
    expect(r.dir).toBe(-1); expect(r.loop).toBe(0); expect(r.turns).toBe(1); expect(r.s).toBeLessThan(side.LEN - 100); expect(r.grade).toBeLessThan(0);
    expect(onLoop / 60).toBeGreaterThan(6); expect(onLoop / 60).toBeLessThan(20);                 // a turn takes seconds, not an instant
    expect(Math.abs(sweep)).toBeGreaterThan(2.5); expect(Math.sign(sweep)).toBe(keep);           // half a turn in all: to the left (anticlockwise from above; x is east, z south) where riders keep right
    expect(r.lane * keep).toBeGreaterThan(0.29); expect(r.uturn).toBe(0);
    expect(r.dist).toBeCloseTo(d0 + side.turn.len + (side.LEN - r.s), 0);                          // every metre round the loop is a metre ridden
  });
  it('turns at the start of the road too, and counts each turn', () => {
    const r = createRider({ body, s: 40, v: 6 }); r.dir = -1; r.lane = 1.75;
    for (let i = 0; i < 60 * 40; i++) stepRider(r, line, 1 / 60, { limits });
    expect(r.dir).toBe(1); expect(r.turns).toBe(1); expect(r.turnEnd).toBe(0); expect(r.s).toBeGreaterThan(20);
    const q = createRider({ body, s: line.LEN - 3, v: 6 }); stepRider(q, line, 1 / 60); q.s = far;       // a skip clean over the loop still counts as a turn
    stepRider(q, line, 1 / 60); expect(q.dir).toBe(-1); expect(q.turns).toBe(1); expect(q.s).toBeLessThanOrEqual(line.LEN);
  });
  it('a U-turn waits until the rider is off the loop', () => {
    const r = createRider({ body, s: line.LEN - 2, v: 5 });
    for (let i = 0; i < 60; i++) stepRider(r, line, 1 / 60, { limits });
    expect(r.loop).toBe(1); expect(uTurn(r)).toBe(false); expect(r.dir).toBe(1);
    for (let i = 0; i < 60 * 20; i++) stepRider(r, line, 1 / 60, { limits });
    expect(r.loop).toBe(0); expect(uTurn(r)).toBe(true); expect(r.dir).toBe(1);
    expect(drawn(r).p.distanceTo(line.P[line.N - 1])).toBeLessThan(200);
  });
  it('where riders keep right, the lane and the steering are mirrored', () => {
    const right = lineOf(route, 1), r = createRider({ body, s: 300, v: 8, lane: 1.75 });
    const run = secs => { for (let i = 0; i < secs * 60; i++) stepRider(r, right, 1 / 60); };
    r.steer = 1; run(5); expect(r.lane).toBeCloseTo(3.2, 6);          // steering right goes to the kerb
    r.steer = -1; run(0.2); expect(r.slide).toBeLessThan(0); run(6); expect(r.lane).toBeCloseTo(0.3, 6);       // and left, to the centre line and no further
    r.steer = 0; uTurn(r); expect(r.lane).toBeCloseTo(-0.3, 6); run(5); expect(r.lane).toBeGreaterThanOrEqual(0.3);
    const pose = right.at(r.s, mkPose()), p = pose.p.clone().addScaledVector(pose.r, r.dir * r.lane), ahead = pose.t.clone().multiplyScalar(r.dir);
    expect((p.x - pose.p.x) * -ahead.z + (p.z - pose.p.z) * ahead.x).toBeGreaterThan(0.29);       // drawn to the right of the way they are going
  });
  it('riders behind you are not ahead of you', () => {
    const me = createRider({ body, s: 500 }), behind = createRider({ body, s: 495, v: 9 }), front = createRider({ body, s: 502, v: 9 });
    expect(gapAhead(me, behind, line)).toBe(Infinity); expect(gapAhead(me, front, line)).toBeCloseTo(2);
    expect(draftOf(me, [behind], line).drag).toBe(1); expect(draftOf(me, [front], line).drag).toBeLessThan(1);
  });
  it('bots stay on the road and keep riding, up and down', () => {
    let seed = 4; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const bots = createBots(line, { humans: 8, near: 200, rand });
    for (let i = 0; i < 400 * 20; i++) for (const b of bots) { b.drag = draftOf(b, bots, line).drag; stepBot(b, bots, line, 1 / 20, { limits }); }
    for (const b of bots) { expect(b.s).toBeGreaterThanOrEqual(-turn.len); expect(b.s).toBeLessThanOrEqual(far); expect(b.dist).toBeGreaterThan(400); expect(Number.isFinite(b.v)).toBe(true); }
  });
});

describe('route library', () => {
  const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v) }; };
  it('lists what comes with Contour', () => { expect(BUILT_IN.slice(0, 2).map(r => r.id)).toEqual(['valley', 'leckhampton']); for (const r of BUILT_IN.slice(2)) expect(r.id).toMatch(/^r:[a-z0-9-]+$/); });
  it('keeps, lists, loads and removes imported routes', () => {
    const s = store(), packed = packRoute('Test climb', buildRoute(makeClimb()));
    const a = saveImported(s, packed, 1000), b = saveImported(s, { ...packed, name: 'Second' }, 2000);
    expect(a).toMatch(/^my:/); expect(listImported(s).map(r => r.name)).toEqual(['Second', 'Test climb']);
    expect(listImported(s)[1]).toMatchObject({ id: a, km: packed.km, up: packed.up, closed: false });
    expect(unpackRoute(loadImported(s, a)).road.length).toBe(packed.pts.length);
    deleteImported(s, a); expect(listImported(s).map(r => r.id)).toEqual([b]); expect(loadImported(s, a)).toBe(null);
  });
  it('copes with a browser that has nothing stored, or junk', () => {
    expect(listImported(store())).toEqual([]); expect(listImported({ getItem: () => 'junk' })).toEqual([]); expect(loadImported({ getItem: () => { throw new Error('blocked'); } }, 'my:x')).toBe(null);
  });
});
