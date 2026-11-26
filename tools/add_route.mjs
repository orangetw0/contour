/* Adds a GPX file to the routes that come with Contour.
   Usage: node tools/add_route.mjs path/to/file.gpx route-id ["Name"] ["Note shown in the list"]
   Writes public/routes/<route-id>.json. To list it and give it surveyed ground, add { id, keep: true, note } to
   tools/routes.mjs and run node tools/build_route.mjs <route-id>. */
import fs from 'node:fs';
import { parseGpx } from '../src/course/gpx.js';
import { buildRoute, packRoute } from '../src/course/route.js';

const [file, id, name, note] = process.argv.slice(2);
if (!file || !/^[a-z0-9-]+$/.test(id || '')) { console.error('usage: node tools/add_route.mjs file.gpx route-id ["Name"] ["Note"]'); process.exit(1); }
const gpx = parseGpx(fs.readFileSync(file, 'utf8')), route = buildRoute(gpx.points, { name: name || gpx.name }), packed = packRoute(name || gpx.name, route);
fs.mkdirSync(new URL('../public/routes/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../public/routes/${id}.json`, import.meta.url), JSON.stringify(packed));
console.log(`${route.road.length} points, ${(route.length / 1000).toFixed(1)} km, ${Math.round(route.ascent)} m up, ${(route.extent / 1000).toFixed(1)} km across, ${route.closed ? 'loop' : 'open'}, ${route.low.toFixed(0)}-${route.high.toFixed(0)} m`);
console.log(`Now add { id: '${id}', keep: true, note: ${JSON.stringify(note || '')} } to tools/routes.mjs and run: node tools/build_route.mjs ${id}`);
