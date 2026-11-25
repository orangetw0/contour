/* Reads a GPX file: the track (or route) points with their heights. Returns { name, points: [{ lat, lon, ele }] }.
   Works on the file's text, so it runs anywhere. Points without a height get the nearest known one. */
export function parseGpx(text) {
  const points = [], re = /<(trkpt|rtept)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g, attr = (s, n) => { const m = new RegExp(`\\b${n}\\s*=\\s*["']([^"']+)["']`).exec(s); return m ? +m[1] : NaN; };
  let m, kind = null;
  while ((m = re.exec(text))) {
    if (kind && m[1] !== kind) continue;                          // a file with both: keep the track, the first kind found
    kind = m[1];
    const lat = attr(m[2], 'lat'), lon = attr(m[2], 'lon'), e = /<ele>\s*([-\d.eE+]+)\s*<\/ele>/.exec(m[4] || '');
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) points.push({ lat, lon, ele: e && Number.isFinite(+e[1]) ? +e[1] : null });
  }
  if (points.length < 2) throw new Error('No track found in this file.');
  if (!points.some(p => p.ele !== null)) throw new Error('This file has no heights, so there would be no hills. Export it with elevation.');
  let last = points.find(p => p.ele !== null).ele;
  for (const p of points) { if (p.ele === null) p.ele = last; else last = p.ele; }
  const name = /<trk>[\s\S]*?<name>(?:<!\[CDATA\[)?\s*([^<\]]+)/.exec(text) || /<name>(?:<!\[CDATA\[)?\s*([^<\]]+)/.exec(text);
  return { name: name ? name[1].trim().slice(0, 60) : 'My route', points };
}
