/* The first screen: choose a route, connect a trainer and heart-rate monitor, check your rider, then ride.
   The ride waits behind it. Skipped when you have just chosen a route here, in scenery mode, and with ?start=0. */
import { $, query } from '../util/dom.js';

export function initStart({ name, note, routes, skip, onRide, riderLine }) {
  let go = false; try { go = sessionStorage.getItem('contour-go') === '1'; sessionStorage.removeItem('contour-go'); } catch {}
  if (skip || go || query.get('start') === '0') return false;
  const box = $('start'), closePanels = () => document.querySelectorAll('.panel').forEach(p => { p.hidden = true; });
  document.body.classList.add('start'); box.hidden = false;
  $('start-route').textContent = `${name}${note ? ' · ' + note : ''}. Pick another route on the right, or ride this one.`;
  $('start-ride').textContent = 'Ride ' + name;
  const state = () => { $('start-rider-state').textContent = riderLine(); $('start-conn-state').textContent = [$('bt').textContent, $('hr').textContent].join(' · '); };
  state(); const timer = setInterval(state, 1000);
  routes.draw($('start-routes'));
  for (const [id, btn] of [['start-conn', 'connbtn'], ['start-rider', 'riderbtn'], ['start-disp', 'dispbtn']]) $(id).onclick = e => { e.stopPropagation(); $(btn).click(); };
  box.addEventListener('click', closePanels);                      // a click outside a panel closes it
  const ride = () => { clearInterval(timer); closePanels(); document.querySelectorAll('#ctl button.on[data-panel]').forEach(b => b.classList.remove('on')); box.hidden = true; document.body.classList.remove('start'); onRide(); };
  $('start-ride').onclick = e => { e.stopPropagation(); ride(); };
  addEventListener('keydown', e => { if (!box.hidden && e.key === 'Enter') ride(); });
  return true;
}
