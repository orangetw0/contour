/* The routes you can ride: the ones that come with Contour, and the ones you have imported (kept in this browser). */
const KEY = 'contour-routes';

export const BUILT_IN = Object.freeze([
  { id: 'valley', name: 'Valley', note: 'An invented mountain valley', km: 3.1, up: 60, closed: true, at: null },
  { id: 'leckhampton', name: 'Leckhampton Hill', note: 'Gloucestershire, England · surveyed terrain', km: 11.9, up: 260, closed: true, at: [51.8684, -2.0647] },
]);

const read = storage => { try { const o = JSON.parse(storage.getItem(KEY)); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };

// imported routes, newest first: [{ id: 'my:<key>', name, at, km, up, closed }]
export const listImported = storage => Object.entries(read(storage)).map(([k, r]) => ({ id: 'my:' + k, name: r.name, at: r.at, km: r.km, up: r.up, closed: r.closed, added: r.added || 0 })).sort((a, b) => b.added - a.added);
export const loadImported = (storage, id) => read(storage)[String(id).replace(/^my:/, '')] || null;

// keep a packed route (from packRoute); returns its id, or throws if the browser has no room
export function saveImported(storage, packed, now = Date.now()) {
  const all = read(storage), key = now.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  all[key] = { ...packed, added: now };
  storage.setItem(KEY, JSON.stringify(all));
  return 'my:' + key;
}
export function deleteImported(storage, id) {
  const all = read(storage); delete all[String(id).replace(/^my:/, '')];
  try { storage.setItem(KEY, JSON.stringify(all)); } catch {}
}
