/* The Routes panel: a world map of where the routes are, the list of routes, and importing your own from a GPX file. */
import { feature } from 'topojson-client';
import land from 'world-atlas/land-110m.json';
import { $, panelButton } from '../util/dom.js';
import { BUILT_IN, listImported, saveImported, deleteImported } from '../course/library.js';
import { parseGpx } from '../course/gpx.js';
import { buildRoute, packRoute, MAX_EXTENT } from '../course/route.js';

const W = 360, H = 180, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the world's land as one SVG path, drawn flat: longitude across, latitude up
const LAND = (() => {
  const geo = feature(land, land.objects.land), polys = geo.features ? geo.features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : geo.geometry.coordinates;
  return polys.map(p => p.map(ring => 'M' + ring.map(([lon, lat]) => `${(lon + 180).toFixed(1)},${(90 - lat).toFixed(1)}`).join('L') + 'Z').join('')).join('');
})();

export function initRoutes({ current, unit }) {
  const panel = $('routes'), btn = $('course');
  let message = '';
  const go = id => { try { sessionStorage.setItem('contour-go', '1'); } catch {} const q = new URLSearchParams(location.search); if (id === 'valley') q.delete('course'); else q.set('course', id); q.delete('theme'); location.search = q.toString(); };
  const draw = (box = panel) => {
    const u = unit(), mine = listImported(localStorage), all = [...BUILT_IN, ...mine];
    const row = r => `<div class="row"><span><b>${esc(r.name)}</b>${r.id === current ? ' · here now' : ''}<br><span class="muted">${u.distance(r.km * 1000).toFixed(1)} ${u.distanceLabel} · ${Math.round(u.height(r.up))} ${u.heightLabel} up · ${r.closed ? 'loop' : 'out and back'}${r.note ? ' · ' + esc(r.note) : ''}</span></span>` +
      `<span>${r.id.startsWith('my:') ? `<button data-del="${esc(r.id)}" title="Remove this route from this browser">Remove</button> ` : ''}${r.id === current ? '' : `<button data-go="${esc(r.id)}">Ride</button>`}</span></div>`;
    const dots = all.filter(r => r.at).map(r => `<circle cx="${(r.at[1] + 180).toFixed(1)}" cy="${(90 - r.at[0]).toFixed(1)}" r="${r.id === current ? 3.4 : 2.6}" class="${r.id === current ? 'here' : ''}" data-go="${esc(r.id)}"><title>${esc(r.name)}</title></circle>`).join('');
    box.innerHTML = `<h3>Routes</h3><svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="World map of routes"><path d="${LAND}"/>${dots}</svg>` +
      BUILT_IN.map(row).join('') + (mine.length ? '<h3 style="margin-top:12px">Your routes</h3>' + mine.map(row).join('') : '') +
      `<label class="file">Add a route from a GPX file<input type="file" accept=".gpx,application/gpx+xml"></label>` +
      (message ? `<div class="note">${esc(message)}</div>` : '') +
      `<div class="note">A GPX file from a ride you recorded or a route you planned gives you its road and its gradients. The scenery around it is invented. A route can cover up to ${u.distance(MAX_EXTENT).toFixed(0)} ${u.distanceLabel} of ground. Routes stay in this browser.</div>`;
    box.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => go(b.dataset.go); });
    box.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { deleteImported(localStorage, b.dataset.del); if (b.dataset.del === current) go('valley'); else draw(box); }; });
    box.querySelector('input[type=file]').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const gpx = parseGpx(await file.text()), route = buildRoute(gpx.points, { name: gpx.name });
        go(saveImported(localStorage, packRoute(gpx.name, route)));
      } catch (err) { message = err && err.name === 'QuotaExceededError' ? 'This browser has no room left to keep another route. Remove one first.' : (err && err.message) || 'That file could not be read as a GPX route.'; draw(box); }
    };
  };
  panelButton(btn, panel, () => draw(panel));
  return { draw };
}
