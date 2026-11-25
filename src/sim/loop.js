/* Fixed-timestep clock for the simulation, separate from drawing.
   Call advance(nowMs) from anywhere, as often or as rarely as you like: it runs step(h) once for each h seconds
   of real time that has passed. So the ride keeps its pace when frames are slow, and keeps going when the tab is
   hidden and the browser stops drawing (a worker timer calls advance then). */
export function createLoop(step, { hz = 60, maxCatchUp = 2 } = {}) {
  const h = 1 / hz;
  let last = null, acc = 0;
  return {
    h,
    advance(nowMs) {
      if (last === null) { last = nowMs; return 0; }
      const elapsed = Math.max(0, (nowMs - last) / 1000);
      last = nowMs;
      acc += Math.min(elapsed, maxCatchUp);          // after a long stall (sleep, a frozen page) don't replay it all
      let n = 0;
      while (acc >= h) { step(h); acc -= h; n++; }
      return n;
    },
    leftover: () => acc,                              // seconds since the last step, for drawing between steps
  };
}
