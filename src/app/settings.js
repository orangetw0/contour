/* The Rider panel: weight, bike and units. Changes apply straight away and are kept in this browser. */
import { $, panelButton } from '../util/dom.js';
import { BIKES, cleanProfile, saveProfile } from '../sim/profile.js';
import { units } from '../sim/units.js';
import { CHARACTERS, KITS } from '../riders/avatar.js';

export function initSettings({ profile, onChange }) {
  const box = $('rider'), btn = $('riderbtn');
  let p = { ...profile };
  const draw = () => {
    const u = units(p.units), bike = BIKES[p.bike];
    box.innerHTML = `<h3>Rider</h3>
      <label>Weight (${u.weightLabel})<input id="p-kg" type="number" min="${Math.round(u.weight(30))}" max="${Math.round(u.weight(200))}" step="0.5" value="${+u.weight(p.riderKg).toFixed(1)}"></label>
      <label>Rider<select id="p-char">${Object.entries(CHARACTERS).map(([k, n]) => `<option value="${k}"${k === p.character ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Kit<select id="p-kit">${Object.entries(KITS).map(([k, c]) => `<option value="${k}"${k === p.kit ? ' selected' : ''}>${c.name}</option>`).join('')}</select></label>
      <label>Bike<select id="p-bike">${Object.entries(BIKES).map(([k, b]) => `<option value="${k}"${k === p.bike ? ' selected' : ''}>${b.name}</option>`).join('')}</select></label>
      <label>Units<select id="p-units"><option value="metric"${p.units === 'metric' ? ' selected' : ''}>Metric</option><option value="imperial"${p.units === 'imperial' ? ' selected' : ''}>Imperial</option></select></label>
      <div class="note">${bike.name}: ${+u.weight(bike.kg).toFixed(1)} ${u.weightLabel}, CdA ${bike.cda} m², rolling resistance ${bike.crr}. Typical figures for this kind of bike, not one model.</div>`;
    const set = change => { p = cleanProfile({ ...p, ...change }); saveProfile(localStorage, p); onChange(p); draw(); };
    $('p-kg').onchange = e => { const n = +e.target.value; if (n > 0) set({ riderKg: n / u.weight(1) }); else draw(); };
    $('p-bike').onchange = e => set({ bike: e.target.value });
    $('p-char').onchange = e => set({ character: e.target.value });
    $('p-kit').onchange = e => set({ kit: e.target.value });
    $('p-units').onchange = e => set({ units: e.target.value });
  };
  panelButton(btn, box, draw);
  box.addEventListener('keydown', e => e.stopPropagation());       // typing a weight must not steer the ride or change the weather
}
