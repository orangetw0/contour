export const $ = id => document.getElementById(id);
export const canvas2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
export const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

// Panels open just under the row of controls, however many lines that row has wrapped onto.
export const placePanel = box => { box.style.top = Math.round($('ctl').getBoundingClientRect().bottom + 10) + 'px'; };
if (typeof addEventListener !== 'undefined') addEventListener('resize', () => document.querySelectorAll('.panel:not([hidden])').forEach(placePanel));
