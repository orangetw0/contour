export const $ = id => document.getElementById(id);
export const canvas2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
export const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
