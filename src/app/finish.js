/* The summary that comes up as you ride under a start/finish arch: the lap or leg just ridden (time, average power,
   distance, climb), shown for five seconds. On a loop every lap gets one; on an out-and-back the far arch closes
   the way out, and the home arch closes the way back and adds the whole ride. The arches are in src/world/arch.js. */
import { $ } from '../util/dom.js';
import { createLaps, createGateWatch } from '../sim/lap.js';

const SHOW_MS = 5000;
const clock = t => { const s = Math.round(t), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; };

export function initFinish({ rider, line, tally, unit, name, start = 0 }) {
  const box = $('finish'), watch = createGateWatch(line, start), laps = createLaps();
  const totals = () => ({ time: rider.time, dist: rider.dist, ascent: tally.ascent, kj: tally.kj });
  const climbs = !line.closed && line.P[line.N - 1].y - line.P[0].y > 30;       // the far end is the top of a climb
  let timer = 0;

  const el = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
  const stat = (value, label) => { const d = document.createElement('div'); d.append(el('b', value), el('span', label)); return d; };
  const figures = (f, u) => [stat(clock(f.time), 'time'), stat(f.avgPower.toFixed(0), 'avg W'),
    stat(u.distance(f.dist).toFixed(2), u.distanceLabel), stat(u.height(f.ascent).toFixed(0), u.heightLabel + ' up')];

  function show(title, sub, f, whole) {
    const u = unit(), row = el('div', '', 'figs');
    row.append(...figures(f, u));
    box.replaceChildren(el('h2', title), el('p', sub), row);
    if (whole) {                                               // the whole ride, smaller, under the leg
      const all = el('div', '', 'figs all');
      all.append(...figures(whole, u));
      box.append(el('p', 'Whole ride'), all);
    }
    box.classList.add('on');
    clearTimeout(timer); timer = setTimeout(() => box.classList.remove('on'), SHOW_MS);
  }

  return {
    watch, laps,
    // call every simulation step: cheap unless an arch has just been passed
    step() {
      const hit = watch.step(rider.s);
      if (!hit) return null;
      const now = totals(), f = laps.mark(now);
      if (hit.kind === 'lap') show(`Lap ${laps.count}`, name, f);
      else if (hit.kind === 'far') show(climbs ? `${name} complete` : `${name}: halfway`, climbs ? 'Top of the climb' : 'The way out', f);
      else show('Back at the start', climbs ? 'The descent' : 'The way back', f, laps.total(now));
      return hit;
    },
  };
}
