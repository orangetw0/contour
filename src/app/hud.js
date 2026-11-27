/* The display while riding: a power card with four slots you choose, the ride's numbers, the climb ahead when
   there is one, and a small map of the route. The Display panel sets what is shown; choices are kept in this browser. */
import { $, panelButton } from '../util/dom.js';
import { wattsPerKg } from '../sim/metrics.js';
import { climbAhead, climbProgress } from '../sim/climb.js';
import { SEASONS, SEASON_KEY, LOOK } from '../world/look.js';

const KEY = 'contour-hud';
const dash = '–', whole = v => v == null ? dash : v.toFixed(0);
// what a slot can show: name in the menu, label under the number, and the number itself
export const METRICS = {
  p3: { name: '3 second power', label: () => '3 s W', value: c => whole(c.p3) },
  avg: { name: 'Average power', label: () => 'avg W', value: c => whole(c.tally.avgPower) },
  np: { name: 'Normalised power', label: () => 'NP W', value: c => whole(c.tally.np) },
  wkg: { name: 'Power to weight', label: () => 'W/kg', value: c => wattsPerKg(c.p3, c.rider.body.riderKg).toFixed(1) },
  hr: { name: 'Heart rate', label: () => 'bpm', value: c => whole(c.rider.hr) },
  cad: { name: 'Cadence', label: () => 'rpm', value: c => whole(c.rider.cadence) },
  kj: { name: 'Work done', label: () => 'kJ', value: c => whole(c.tally.kj) },
  grade: { name: 'Gradient', label: () => 'grade %', value: c => (c.rider.grade >= 0 ? '+' : '') + c.rider.grade.toFixed(1) },
  alt: { name: 'Altitude', label: c => c.unit.heightLabel, value: c => whole(c.unit.height(c.rider.altitude)) },
  avgspd: { name: 'Average speed', label: c => 'avg ' + c.unit.speedLabel, value: c => c.unit.speed(c.tally.avgSpeed).toFixed(1) },
  draft: { name: 'Draft', label: () => 'draft %', value: c => whole((1 - c.rider.drag) * 100) },
  none: { name: 'Nothing', label: () => '', value: () => '' },
};
const DEFAULT = { slots: ['p3', 'wkg', 'hr', 'cad'], climbAt: 3, climbOpen: true, map: true };
export const cleanHud = raw => {
  const o = raw && typeof raw === 'object' ? raw : {}, slots = Array.isArray(o.slots) ? o.slots.slice(0, 4) : [];
  return { slots: DEFAULT.slots.map((d, i) => METRICS[slots[i]] ? slots[i] : d), climbAt: [0, 2, 3, 4, 6].includes(+o.climbAt) ? +o.climbAt : DEFAULT.climbAt, climbOpen: o.climbOpen !== false, map: o.map !== false };
};
const clock = t => { const s = Math.floor(t), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; };
const BANDS = [[2, '#6fb3a8'], [5, '#e0c35c'], [8, '#e89a4c'], [11, '#d9603f'], [Infinity, '#a8324a']];
const band = g => BANDS.find(b => g < b[0])[1];

export function initHud({ rider, line, bots, tally, unit, name }) {
  let set = DEFAULT; try { set = cleanHud(JSON.parse(localStorage.getItem(KEY))); } catch { set = cleanHud(null); }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(set)); } catch {} };
  const pose = line.scratch;

  // ---- the Display panel
  const body = $('display-body'), opt = (v, text, on) => `<option value="${v}"${on ? ' selected' : ''}>${text}</option>`;
  const draw = () => {
    body.innerHTML = '<h3>Power card</h3>' + set.slots.map((k, i) => `<label>Slot ${i + 1}<select data-slot="${i}">${Object.entries(METRICS).map(([id, m]) => opt(id, m.name, id === k)).join('')}</select></label>`).join('') +
      `<h3 style="margin-top:12px">On screen</h3>
      <label>Climb ahead<select id="d-climb">${opt(0, 'Never', set.climbAt === 0)}${[2, 3, 4, 6].map(v => opt(v, `Climbs over ${v} %`, set.climbAt === v)).join('')}</select></label>
      <label>Route map<select id="d-map">${opt(1, 'Shown', set.map)}${opt(0, 'Hidden', !set.map)}</select></label>
      <label>Season<select id="d-season">${SEASONS.map(v => opt(v, v[0].toUpperCase() + v.slice(1), v === LOOK.season)).join('')}</select></label>
      <div class="note">The climb view appears when the road ahead rises more steeply than this, shows where you are on the climb, and goes at the top. The tab under it tucks it away. Changing the season rebuilds the scenery.</div>`;
    body.querySelectorAll('[data-slot]').forEach(s => { s.onchange = () => { set.slots[+s.dataset.slot] = s.value; keep(); labels(); }; });
    $('d-climb').onchange = e => { set.climbAt = +e.target.value; keep(); climb = null; };
    $('d-map').onchange = e => { set.map = e.target.value === '1'; keep(); $('mapbox').hidden = !set.map; };
    $('d-season').onchange = e => { try { localStorage.setItem(SEASON_KEY, e.target.value); sessionStorage.setItem('contour-go', '1'); } catch {} const q = new URLSearchParams(location.search); q.delete('season'); location.search = q.toString(); };
  };
  panelButton($('dispbtn'), $('display'), draw);
  $('display').addEventListener('keydown', e => e.stopPropagation());

  const ctx = { rider, tally, unit: unit(), p3: 0 };
  const labels = () => { ctx.unit = unit(); set.slots.forEach((k, i) => { $('slot' + i + 'l').textContent = METRICS[k].label(ctx); }); $('h-sp-u').textContent = ctx.unit.speedLabel; $('h-di-u').textContent = ctx.unit.distanceLabel; $('h-up-u').textContent = ctx.unit.heightLabel + ' up'; };
  labels();
  $('mapbox').hidden = !set.map; $('m-name').textContent = name;

  // ---- the route map: the whole road, north up, fitted to the box
  const mini = $('mini'), mg = mini.getContext('2d'), MW = mini.width, MH = mini.height, pad = 14;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of line.P) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const k = Math.min((MW - 2 * pad) / Math.max(1, x1 - x0), (MH - 2 * pad) / Math.max(1, z1 - z0)), ox = (MW - (x1 - x0) * k) / 2 - x0 * k, oz = (MH - (z1 - z0) * k) / 2 - z0 * k;
  const path = new Path2D(), every = Math.max(1, Math.floor(line.N / 900));
  for (let i = 0; i < line.N; i += every) { const p = line.P[i]; if (i) path.lineTo(p.x * k + ox, p.z * k + oz); else path.moveTo(p.x * k + ox, p.z * k + oz); }
  if (line.closed) path.closePath();
  const dot = (s, r, fill) => { line.at(s, pose); mg.beginPath(); mg.arc(pose.p.x * k + ox, pose.p.z * k + oz, r, 0, 6.283); mg.fillStyle = fill; mg.fill(); };
  function drawMap() {
    mg.clearRect(0, 0, MW, MH); mg.lineJoin = 'round';
    mg.strokeStyle = 'rgba(0,0,0,.5)'; mg.lineWidth = 7; mg.stroke(path);
    mg.strokeStyle = 'rgba(255,255,255,.85)'; mg.lineWidth = 3.5; mg.stroke(path);
    for (const b of bots) dot(b.s, b.pacer ? 5 : 3.5, b.pacer ? '#7fd0ff' : 'rgba(40,40,40,.85)');
    dot(rider.s, 9, '#2a1c0c'); dot(rider.s, 6.5, '#ffcf8f');
    $('m-alt').textContent = `${Math.round(ctx.unit.height(rider.altitude))} ${ctx.unit.heightLabel}`;
  }

  // ---- the climb: found when it comes into reach, then kept as it was found, so the picture stays still and the rider moves along it
  const cv = $('climb'), cg = cv.getContext('2d'), CW = cv.width, CH = cv.height, box = $('climbbox'), tab = $('climbtab');
  let climb = null, showing = false, gone = 0;                  // climb: { c: what climbAhead found, s0: where the rider was then, dir: which way they were riding }
  const heightAhead = d => { line.at(line.wrap(rider.s + rider.dir * d), pose); return pose.p.y; };
  // how far the rider has come since the climb was found; on a loop, counted round the loop from just before the picture's left edge
  const along = () => {
    const d = rider.dir * (rider.s - climb.s0), lo = climb.c.from - 50;
    return line.closed ? lo + (((d - lo) % line.LEN) + line.LEN) % line.LEN : d;
  };
  // the tab under the view: tucks it away, or brings it back. Only there while there is a climb to show.
  const place = () => {
    box.hidden = !(showing && set.climbOpen); tab.hidden = !showing; tab.classList.toggle('shut', !set.climbOpen);
    tab.title = set.climbOpen ? 'Hide the climb' : 'Show the climb'; tab.setAttribute('aria-label', tab.title); tab.setAttribute('aria-expanded', String(set.climbOpen));
  };
  tab.addEventListener('click', e => { e.stopPropagation(); set.climbOpen = !set.climbOpen; keep(); place(); drawClimb(0); tab.blur(); });
  place();
  function drawClimb(dt) {
    let d = 0;
    if (set.climbAt <= 0) climb = null;
    // done with it once over the top, turned round, or somewhere else altogether (a skip up the road, a U-turn)
    if (climb) { d = along(); if (rider.dir !== climb.dir || d < climb.c.from - 50 || d >= climb.c.end) climb = null; }
    if (!climb && set.climbAt > 0) {
      const ahead = rider.dir > 0 ? line.LEN - rider.s : rider.s, c = climbAhead(heightAhead, { limit: line.closed ? Infinity : ahead, behind: line.closed ? Infinity : line.LEN - ahead, threshold: set.climbAt });
      if (c) { climb = { c, s0: rider.s, dir: rider.dir }; d = 0; }
    }
    if (climb) gone = 0; else gone += dt;
    const show = !!climb || (showing && gone < 3);
    if (show !== showing) { showing = show; place(); }
    if (!climb || !set.climbOpen) return;
    const c = climb.c, now = climbProgress(c, d), h = c.heights, n = h.length - 1, lo = Math.min(...h), hi = Math.max(...h), span = Math.max(8, hi - lo);
    const X = i => i / n * CW, Y = v => CH - 14 - (v - lo) / span * (CH - 60), at = m => X((m - c.from) / c.step);
    cg.clearRect(0, 0, CW, CH);
    for (let i = 0; i < n; i++) {                              // one slice per sample, coloured by how steep it is
      cg.beginPath(); cg.moveTo(X(i), CH); cg.lineTo(X(i), Y(h[i])); cg.lineTo(X(i + 1) + 1, Y(h[i + 1])); cg.lineTo(X(i + 1) + 1, CH); cg.closePath();
      const a = Math.max(0, i - 2), b = Math.min(n, i + 3);      // the gradient over about 125 m, so the colours read as stretches of road
      cg.fillStyle = band((h[b] - h[a]) / ((b - a) * c.step) * 100); cg.fill();
    }
    const road = new Path2D(); h.forEach((v, i) => road.lineTo(X(i), Y(v)));
    const under = new Path2D(road); under.lineTo(CW, CH); under.lineTo(0, CH); under.closePath();
    const rx = Math.max(0, Math.min(CW, at(d))), mx = Math.max(15, Math.min(CW - 15, rx)), my = Y(now.height);
    cg.save(); cg.beginPath(); cg.rect(0, 0, rx, CH); cg.clip(); cg.fillStyle = 'rgba(20,16,12,.62)'; cg.fill(under); cg.restore();   // the road already ridden, dimmed
    cg.strokeStyle = 'rgba(255,255,255,.6)'; cg.lineWidth = 2.5; cg.lineJoin = 'round'; cg.stroke(road);
    const tx = at(c.end);                                      // the top
    cg.strokeStyle = 'rgba(255,255,255,.9)'; cg.lineWidth = 3; cg.setLineDash([8, 8]); cg.beginPath(); cg.moveTo(tx, Y(h[Math.round((c.end - c.from) / c.step)]) - 34); cg.lineTo(tx, CH); cg.stroke(); cg.setLineDash([]);
    // the rider: a line down to the foot of the picture, and a ringed dot sitting on the road
    cg.strokeStyle = '#fff'; cg.lineWidth = 3; cg.beginPath(); cg.moveTo(mx, my); cg.lineTo(mx, CH); cg.stroke();
    cg.beginPath(); cg.arc(mx, my, 13, 0, 6.283); cg.fillStyle = '#2a1c0c'; cg.fill(); cg.lineWidth = 3.5; cg.stroke();
    cg.beginPath(); cg.arc(mx, my, 6.5, 0, 6.283); cg.fillStyle = '#ffcf8f'; cg.fill();
    cg.fillStyle = '#fff'; cg.font = '600 34px -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif'; cg.textBaseline = 'top';
    cg.fillText(`${rider.grade >= 0 ? '+' : ''}${rider.grade.toFixed(1)} %`, 10, 6);
    const u = ctx.unit, far = u.distance(now.toTop);
    $('climbcap').innerHTML = `<span>${now.toFoot > 40 ? `Climb in ${Math.round(u.height(now.toFoot))} ${u.heightLabel}` : 'Climbing'}</span><span>${far >= 1 ? far.toFixed(1) + ' ' + u.distanceLabel : Math.round(u.height(now.toTop)) + ' ' + u.heightLabel} to the top · ${Math.round(u.height(now.toGain))} ${u.heightLabel} · ${now.avg.toFixed(1)} %</span>`;
  }

  return {
    labels,
    // four times a second
    update(p3, v, dt) {
      ctx.p3 = p3; ctx.unit = unit();
      $('h-pw').textContent = rider.target.toFixed(0);
      set.slots.forEach((id, i) => { $('slot' + i).textContent = METRICS[id].value(ctx); });
      $('h-sp').textContent = ctx.unit.speed(v).toFixed(1);
      $('h-di').textContent = ctx.unit.distance(rider.dist).toFixed(2);
      $('h-up').textContent = Math.round(ctx.unit.height(tally.ascent));
      $('h-tm').textContent = clock(rider.time);
      $('h-gr').textContent = (rider.grade >= 0 ? '+' : '') + rider.grade.toFixed(1);
      if (set.map) drawMap();
      drawClimb(dt);
    },
  };
}
