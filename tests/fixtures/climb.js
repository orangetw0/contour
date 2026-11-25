/* A made-up climb for testing: about 6 km at 8 % with five hairpins, like a mountain road but not any real one.
   Heights carry a few metres of noise, as recorded tracks do. */
export function makeClimb() {
  const pts = [], lat0 = 45.2, lon0 = 6.4, mLat = 111194.9, mLon = mLat * Math.cos(lat0 * Math.PI / 180);
  let x = 0, z = 0, heading = 0.2, ele = 720, seed = 11;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const add = () => pts.push({ lat: lat0 - z / mLat, lon: lon0 + x / mLon, ele: +(ele + (rand() - 0.5) * 6).toFixed(1) });
  const go = (metres, turn = 0) => { for (let d = 0; d < metres; d += 12) { heading += turn * 12; x += Math.cos(heading) * 12; z += Math.sin(heading) * 12 * 0.6 - 12 * 0.25; ele += 12 * 0.08; add(); } };
  add();
  for (let leg = 0; leg < 6; leg++) { go(900, (leg % 2 ? 1 : -1) * 0.0004); if (leg < 5) go(96, (leg % 2 ? 1 : -1) * Math.PI / 96); }     // each hairpin turns up the hill, so the legs never cross
  return pts;
}

export const climbGpx = () => `<?xml version="1.0"?><gpx version="1.1" creator="contour-tests"><trk><name>Test climb</name><trkseg>
${makeClimb().map(p => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele}</ele></trkpt>`).join('\n')}
</trkseg></trk></gpx>`;
