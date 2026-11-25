/* Drafting: riding in another rider's wake cuts your air drag. The saving is biggest right on the wheel, fades
   with the gap and with riding off to one side, and is larger behind a bigger rider. */
export const DRAFT = Object.freeze({ best: 0.32, fade: 4, width: 1.0, reach: 15, bikeLength: 1.7, groupBonus: 0.25, cap: 0.45, refCda: 0.32 });

/* How far ahead of `me` rider `o` is, in metres along the road in my direction of travel. On a loop that is always
   somewhere from 0 to the loop's length; on an open road a rider behind me is not ahead at all (Infinity).
   course: a course line, or just a loop's length. */
export function gapAhead(me, o, course) {
  const LEN = typeof course === 'number' ? course : course.LEN, d = (o.s - me.s) * me.dir;
  if (typeof course !== 'number' && !course.closed) return d >= 0 ? d : Infinity;
  return ((d % LEN) + LEN) % LEN;
}

/* The share of air drag `me` still feels (1: none saved) given everyone else on the road, and who is giving the
   most shelter. Riders going the other way give none. */
export function draftOf(me, riders, course, out = { drag: 1, from: null, gap: Infinity }) {
  let best = 0, second = 0; out.from = null; out.gap = Infinity;
  for (const o of riders) {
    if (o === me || o.dir !== me.dir || o.v < 2) continue;
    const gap = gapAhead(me, o, course);
    if (gap < 0.2 || gap > DRAFT.reach) continue;
    const side = Math.abs(o.lane - me.lane);
    if (side >= DRAFT.width) continue;
    const save = DRAFT.best * (o.body.cda / DRAFT.refCda) * Math.exp(-Math.max(0, gap - DRAFT.bikeLength) / DRAFT.fade) * (1 - side / DRAFT.width);
    if (save > best) { second = best; best = save; out.from = o; out.gap = gap; } else if (save > second) second = save;
  }
  out.drag = 1 - Math.min(DRAFT.cap, best + second * DRAFT.groupBonus);
  return out;
}
