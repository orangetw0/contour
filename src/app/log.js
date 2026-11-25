/* Ride log: distance ridden, kept in this browser (localStorage). */
import { $, panelButton } from '../util/dom.js';
import { COURSE_NAMES } from '../course/index.js';

const KEY = 'contour-log', MIN = 100;         // rides under 100 m are not kept

// unit: a function returning the current display units, since they can change mid-ride
export function initLog({ rider, course, unit }) {
  const load = () => { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; } catch { return []; } };
  const ride = { t: new Date().toISOString(), c: course, m: 0, s: 0 };
  let ok = true;
  const save = () => {
    ride.s = rider.time; ride.m = Math.round(rider.dist);     // time comes from the simulation, so it counts while the tab is hidden too
    if (ride.m < MIN) return;
    const all = load().filter(r => r.t !== ride.t); all.push({ ...ride, s: Math.round(ride.s) });
    try { localStorage.setItem(KEY, JSON.stringify(all.slice(-300))); ok = true; } catch { ok = false; }
  };
  const far = m => { const d = unit().distance(m); return d.toFixed(d < 99.95 ? 1 : 0); }, box = $('log'), btn = $('logbtn');
  const day = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const mins = s => s < 3600 ? Math.round(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.round(s % 3600 / 60) + ' min';
  const draw = () => {
    const u = unit().distanceLabel;
    const all = load().filter(r => r.t !== ride.t); if (rider.dist >= MIN) all.push({ ...ride, m: Math.round(rider.dist) });
    const today = new Date().toDateString(), sum = f => all.filter(f).reduce((a, r) => a + r.m, 0);
    const rows = all.slice(-10).reverse().map(r => `<tr><td>${day(r.t)}</td><td class="muted">${COURSE_NAMES[r.c] || 'Valley'}</td><td class="muted">${mins(r.s)}</td><td>${far(r.m)} ${u}</td></tr>`).join('');
    box.innerHTML = `<h3>Ride log</h3><div class="tot"><div><b>${far(sum(r => new Date(r.t).toDateString() === today))}</b><span>${u} today</span></div>` +
      `<div><b>${far(sum(() => true))}</b><span>${u} in total</span></div><div><b>${all.length}</b><span>rides</span></div></div>` +
      (rows ? `<table>${rows}</table>` : `<div class="muted">Rides appear here after the first 100 m.</div>`) +
      (ok ? '' : `<div class="muted" style="margin-top:8px">This browser is not letting the page save, so the log will not be kept.</div>`) +
      (all.length ? `<button id="logclear">Clear log</button>` : '');
    const c = $('logclear'); if (c) c.onclick = () => { if (confirm('Delete the whole ride log from this browser?')) { try { localStorage.removeItem(KEY); } catch {} rider.dist = 0; rider.time = 0; draw(); } };
  };
  panelButton(btn, box, draw);
  setInterval(() => { save(); if (!box.hidden) draw(); }, 5000);
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', save);
}
