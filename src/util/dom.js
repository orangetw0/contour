export const $ = id => document.getElementById(id);
export const canvas2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
export const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

// One panel open at a time: opening one closes the others. draw() fills the panel each time it opens.
export function panelButton(btn, box, draw) {
  btn.onclick = () => {
    const open = box.hidden;
    document.querySelectorAll('.panel').forEach(p => { p.hidden = true; }); document.querySelectorAll('#ctl button[data-panel]').forEach(b => b.classList.remove('on'));
    box.hidden = !open; btn.classList.toggle('on', open);
    if (open) { placePanel(box); draw(); }
  };
  btn.dataset.panel = '1';
  box.addEventListener('click', e => e.stopPropagation());
}

// Panels open just under the row of controls, however many lines that row has wrapped onto.
export const placePanel = box => { box.style.top = Math.round($('ctl').getBoundingClientRect().bottom + 10) + 'px'; };
if (typeof addEventListener !== 'undefined') addEventListener('resize', () => document.querySelectorAll('.panel:not([hidden])').forEach(placePanel));
