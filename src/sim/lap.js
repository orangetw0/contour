/* Laps and legs. Where the start/finish arches stand on a course, noticing when a rider passes under one, and
   the figures for the stretch just ridden (time, distance, climb, average power). Pure sums: no drawing here. */

/* Where the arches stand, in metres along the road.
   A loop has one, the lap line, just ahead of where the ride begins.
   An out-and-back has two: "home" a little way up the road from the start, and "far" just before the far end. */
export function gatesFor({ LEN, closed }, start = 0) {
  if (closed) return { lap: (start + 20) % LEN };
  const home = Math.min(start + 30, LEN * 0.25);
  return { home, far: Math.max(LEN - 40, LEN * 0.75) };
}

/* Figures for each stretch as differences of the ride's running totals.
   totals: { time (s), dist (m), ascent (m), kj }. mark() closes the stretch and starts the next from zero. */
export function createLaps(start = { time: 0, dist: 0, ascent: 0, kj: 0 }) {
  const copy = t => ({ time: t.time, dist: t.dist, ascent: t.ascent, kj: t.kj });
  const since = (a, b) => {
    const time = b.time - a.time;
    return { time, dist: b.dist - a.dist, ascent: b.ascent - a.ascent, avgPower: time > 0 ? (b.kj - a.kj) * 1000 / time : 0 };
  };
  const first = copy(start);
  let last = first, count = 0;
  return {
    get count() { return count; },
    peek: totals => since(last, totals),                       // the stretch so far, without closing it
    total: totals => since(first, totals),                     // the whole ride
    mark(totals) { const out = since(last, totals); last = copy(totals); count++; return out; },
  };
}

/* Watches one rider's place on the road and says when they pass under an arch in a way that counts.
   Call step(s) often (every simulation step) with the rider's metres along the road. It returns null, or:
     { kind: 'lap' }   a loop: the lap line crossed after riding most of a lap the same way round
     { kind: 'far' }   an out-and-back: through the far arch on the way out
     { kind: 'home' }  an out-and-back: back through the home arch after having been to the far one
   Ignored: the first crossing just after the start, a skip back over the line and forward again, and crossing
   the wrong way after a U-turn. A skip up the road counts as road covered. */
export function createGateWatch({ LEN, closed }, start = 0) {
  const gates = gatesFor({ LEN, closed }, start), half = LEN / 2;
  const short = d => ((d + half) % LEN + LEN) % LEN - half;         // a loop: the short way round, -half to +half
  let prev = start, progress = 0, out = true;                         // out: still to reach the far arch

  // did the move from a to b pass over g? +1 going up the road, -1 coming back down it, 0 not at all
  const over = (a, b, g) => a < g && b >= g ? 1 : a > g && b <= g ? -1 : 0;

  function step(s) {
    let hit = null;
    if (closed) {
      const d = short(s - prev), rel = short(prev - gates.lap), way = over(rel, rel + d, 0);
      progress += d;                                                  // metres round the loop since the line, signed
      if (way) {
        if (progress * way >= LEN * 0.8) hit = { kind: 'lap' };
        progress = rel + d;                                           // start counting again from the line itself
      }
    } else {
      if (out && over(prev, s, gates.far) > 0) { out = false; hit = { kind: 'far' }; }
      else if (!out && over(prev, s, gates.home) < 0) { out = true; hit = { kind: 'home' }; }
    }
    prev = s;
    return hit;
  }
  return { gates, step };
}
