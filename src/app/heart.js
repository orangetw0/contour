/* Heart-rate monitor over Web Bluetooth (Chrome or Edge): any strap or watch that broadcasts the standard service. */
import { $ } from '../util/dom.js';
import { heartRate } from '../devices/sensors.js';

export function initHeart({ rider }) {
  const btn = $('hr');
  let dev = null, busy = false;
  const label = t => { btn.textContent = t; btn.classList.toggle('on', !!(dev && dev.gatt.connected)); };
  async function use(d) {
    const server = await d.gatt.connect();
    const ch = await (await server.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged', e => { const bpm = heartRate(e.target.value); if (bpm) rider.hr = bpm; });
    dev = d; btn.title = d.name || ''; label('Heart rate: on');
  }
  btn.addEventListener('click', async () => {
    if (!navigator.bluetooth) { label('Needs Chrome or Edge'); return; }
    if (busy) return;
    busy = true;
    try {
      if (dev && dev.gatt.connected) { dev.gatt.disconnect(); return; }           // a second click turns it off
      const d = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
      label('Connecting…');
      d.addEventListener('gattserverdisconnected', async () => {
        rider.hr = null; label('Heart rate');
        for (let i = 0; i < 6 && dev === d && !d.gatt.connected && !busy; i++) {   // a dropped strap: try it again a few times
          await new Promise(r => setTimeout(r, 2500));
          try { if (dev === d && !d.gatt.connected) await use(d); } catch (err) {}
        }
      });
      await use(d);
    } catch (err) { label('Heart rate'); }
    finally { busy = false; if (dev && !dev.gatt.connected) { dev = null; label('Heart rate'); } }
  });
}
