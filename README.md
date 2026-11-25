# Contour

An indoor cycling ride that runs in the browser (Three.js). A fork of Jamie Marsland's
[Golden Hour Ride](https://github.com/jamiemarsland/golden-hour-ride), being rebuilt to grow: realistic physics,
rider profiles, other riders, real routes and ride export.

## What's in it

- Two courses: an invented mountain valley, and a real 11.9 km Leckhampton loop built from Environment Agency lidar, dressed as the 19th-century hill (sheep, hay stooks, quarry smoke). `?course=leckhampton` opens the loop.
- Four looks: Golden, Overcast, Rain and Mist. Buttons at the top, keys 1–4, or by voice. `?theme=christmas` gives the valley under snow.
- Skip forward and back 250 m with the arrow keys.
- Hide everything on screen for a clean view: the Hide info button, the H key, or say "hide". `?scenery` drifts along on its own.
- Power from a slider, or from a Bluetooth trainer (Chrome or Edge). Power is read from the Cycling Power service, or from the Fitness Machine Service (FTMS) on trainers that have only that. If the trainer supports resistance control, the ride also sends it the road gradient; the − and + buttons set how much of each hill it feels (`?hills=` sets it for one visit).
- The ride keeps going at the right pace when the tab is hidden or frames are slow.
- `?units=imperial` shows miles and mph.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173/
npm test           # simulation tests
npm run build      # static site in dist/
```

## Layout

- `index.html` – the page's markup.
- `src/main.js` – entry point: wires the simulation to the world and the controls, and draws each frame.
- `src/sim/` – the simulation, with no drawing in it: `physics.js` (power to speed), `rider.js` (one rider's state), `profile.js` (weight, CdA, units), `loop.js` (fixed-timestep clock), `units.js`.
- `src/course/` – the road line (`line.js`) and course loading (`index.js`).
- `src/devices/ftms.js` – Bluetooth trainer messages.
- `src/app/` – trainer connection, ride log, voice and sound.
- `src/world/world.js` – everything you see. Still one long build script from the original; splitting it up is next.
- `public/assets/` – textures and course data.
- `tools/` – scripts that build the Leckhampton course data.
- `tests/` – tests for the simulation, course line and trainer messages.

The physics is still the original's model (`LEGACY` in `src/sim/physics.js`): descents count half and the rider brakes
above 54 km/h. It is kept behind one interface so a realistic model can replace it.

## Credits

- Original ride: Jamie Marsland, Golden Hour Ride (MIT).
- Textures: Poly Haven (CC0).
- Terrain: Environment Agency LiDAR Composite DTM, Open Government Licence v3.0.
- Roads, woodland and field boundaries: © OpenStreetMap contributors, ODbL.
- 3D engine: Three.js (MIT).

## Licence

The code is released under the MIT licence: see `LICENSE`.

The MIT licence covers the code only. The course data in `public/assets/leckhampton.js` and
`public/assets/leckhampton_osm.js` is derived from the sources credited above and stays under their terms: the Open
Government Licence v3.0 for the terrain and the ODbL for the OpenStreetMap data. If you share or adapt that data, keep
those credits.
