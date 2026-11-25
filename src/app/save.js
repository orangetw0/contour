/* Save ride: download what has been recorded so far as a FIT file. */
import { $ } from '../util/dom.js';
import { encodeFit } from '../export/fit.js';

export function initSave({ recorder, course }) {
  const btn = $('save');
  let timer = 0;
  const flash = t => { btn.textContent = t; clearTimeout(timer); timer = setTimeout(() => { btn.textContent = 'Save ride'; }, 3000); };
  btn.addEventListener('click', () => {
    const summary = recorder.summary();
    if (!summary || summary.moving < 10) { flash('Nothing to save yet'); return; }
    const bytes = encodeFit(recorder.samples, summary, { serial: recorder.startUnix >>> 0 });
    const day = new Date(summary.start * 1000), pad = n => String(n).padStart(2, '0');
    const name = `contour-${course}-${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}-${pad(day.getHours())}${pad(day.getMinutes())}.fit`;
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    flash('Saved');
  });
}
