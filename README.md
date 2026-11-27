# Contour

An indoor cycling ride that runs in the browser (Three.js). A fork of Jamie Marsland's
[Golden Hour Ride](https://github.com/jamiemarsland/golden-hour-ride), being rebuilt to grow: realistic physics,
rider profiles, other riders, real routes and ride export.

## What's in it

- The first screen: choose a route from the list or the world map, open Connections (trainer, hill feel, heart rate, voice, keys), check your rider, then ride.
- The display: a power card with four slots you choose in the Display panel (3 s power, average and normalised power, W/kg, heart rate, cadence, work, gradient, altitude, average speed, draft); speed, distance, metres climbed and time; a profile of the climb ahead that appears when the road rises past a gradient you set and goes when it levels off; and a map of the route with you and the other riders on it.
- Each place looks like itself: grass and trees are tinted by region and by the season you choose (spring, summer, autumn, winter, with the snow line moving), and roads are surfaced and painted to suit: full markings, weathered pass roads with edge lines only, bleached unpainted lanes, Dutch broken edge lines, double yellow in the US, granite setts on the Tremola.
- Routes: an invented mountain valley; a real 11.9 km Leckhampton loop built from Environment Agency lidar, dressed as the 19th-century hill (sheep, hay stooks, quarry smoke); sixteen real roads in Europe, from a flat polder loop to the Stelvio; and your own. The Routes panel shows them on a world map.
- Real roads: built by `node tools/build_route.mjs <id|all>` from the list in `tools/routes.mjs`. The road comes from OpenStreetMap through the OSRM router, the heights and the ground around it from the Copernicus 30 m elevation model, with lakes and the sea where the survey is dead level. Which ground is wooded is estimated per route for now. Road © OpenStreetMap contributors (ODbL). Terrain produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.
- Your own routes: add a GPX file from a ride you recorded or a route you planned and ride its road and its gradients, as a loop or an out-and-back climb (riders turn round at the ends). The scenery around an imported road is invented to fit it; a route can cover up to 25 km of ground, with coarser ground the bigger it is. `node tools/add_route.mjs file.gpx route-id` turns a GPX into a route file in `public/routes`; add `{ id, keep: true }` to `tools/routes.mjs` and run `build_route.mjs` to give it surveyed ground and list it. Saved rides carry the route's real GPS.
- Four looks: Golden, Overcast, Rain and Mist. Buttons at the top, keys 1–4, or by voice. `?theme=christmas` gives the valley under snow.
- Your rider on screen: a rigged male or female character in cycling kit on a road bike, pedalling at your cadence, seen from behind (the V key switches to the view from the saddle). The body follows your height and weight, on a frame sized to fit. Riders wear a fitted helmet, wrap-round glasses, short-finger gloves, road shoes and one of eight original kit designs, and hold the brake hoods. Two original bike designs: a slim-tubed climbing bike and a deep-section aero bike, chosen by your bike type. Choose the rider, kit and skin tone in the Rider panel.
- Steering: hold ← or → (or A and D) to move across your lane. U turns round and rides back the other way. P pauses.
- Other riders: a field of bots with the same physics as you. They push on climbs, coast descents, sit on wheels, pull out to pass and chat among themselves. `?bots=0` rides alone; `?bots=30` brings a crowd.
- Drafting: sit behind another rider and your air drag drops by up to about a third, more behind a bigger rider. The HUD shows the saving.
- Pacers: four riders holding 1.5, 2.2, 3.0 and 4.0 w/kg round the course. The Pacers panel shows where they are and drops you onto a wheel.
- Skip forward and back 250 m with the ] and [ keys.
- Hide everything on screen for a clean view: the Hide info button, the H key, or say "hide". `?scenery` drifts along on its own.
- Power from a slider, or from a Bluetooth trainer (Chrome or Edge). Power is read from the Cycling Power service, or from the Fitness Machine Service (FTMS) on trainers that have only that. If the trainer supports resistance control, the ride also sends it the road gradient; the − and + buttons set how much of each hill it feels (`?hills=` sets it for one visit).
- Realistic speed: gravity counts in full up and down, air thins with altitude, the drivetrain loses a little, and the rider brakes for bends instead of at a fixed speed. `?physics=legacy` brings back the original rules.
- Rider panel: your weight, a bike type (all-round, climbing, aero, time trial, gravel) and metric or imperial units. Kept in the browser.
- Power shown three ways: instant, 3-second average and watts per kilo.
- Heart rate from any Bluetooth monitor, and cadence from the trainer when it sends it.
- Save ride: downloads the ride as a FIT file with power, heart rate, cadence and, on real courses, GPS, ready to upload to Strava, Garmin Connect or Wahoo.
- The ride keeps going at the right pace when the tab is hidden or frames are slow.

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
- `src/sim/` – the simulation, with no drawing in it: `physics.js` (power to speed), `rider.js` (one rider's state), `profile.js` (weight and bike types), `loop.js` (fixed-timestep clock), `metrics.js` (rolling power, w/kg), `recorder.js` (one sample a second), `draft.js` (shelter behind other riders), `bots.js` (other riders and pacers), `chatter.js` (what they say), `units.js`.
- `src/course/` – the road line, loop or open-ended (`line.js`), how fast each bend can be taken (`speedLimit.js`), reading GPX (`gpx.js`), turning a track into a course (`route.js`), inventing ground round it (`terrainGen.js`), the list of routes (`library.js`) and course loading (`index.js`).
- `src/devices/` – Bluetooth message formats: trainer (`ftms.js`), heart rate and cadence (`sensors.js`).
- `src/export/fit.js` – writes a ride as a FIT file.
- `src/riders/` – the rider you see: the bike (`bike.js`), the character and riding position (`avatar.js`), kit designs (`kit.js`), helmet, glasses and shoes (`gear.js`), body shape from height and weight (`body.js`), the posing maths (`ik.js`) and placing them on the road (`riderView.js`). `tools/avatar-preview.html` shows riders on their own while the dev server runs.
- `src/app/` – trainer and heart-rate connections, Rider panel, Routes panel and world map (`routes.js`), other riders and pacers (`company.js`), ride log, save, voice and sound.
- `src/world/` – everything you see, one file per part (terrain, road, pines, weather…). Each imports the one before it, because the scenery is built from one seeded random sequence.
- `public/assets/` – textures and course data.
- `tools/` – scripts that build the Leckhampton course data.
- `tests/` – tests for the simulation, course line and trainer messages.

## Credits

- Original ride: Jamie Marsland, Golden Hour Ride (MIT).
- Rider models: Quaternius, Universal Base Characters (CC0).
- Textures: Poly Haven (CC0).
- Terrain: Environment Agency LiDAR Composite DTM, Open Government Licence v3.0.
- Roads, woodland and field boundaries: © OpenStreetMap contributors, ODbL.
- World map outline: Natural Earth, via world-atlas (public domain data).
- 3D engine: Three.js (MIT).

## Licence

The code is released under the MIT licence: see `LICENSE`.

The MIT licence covers the code only. The course data in `public/assets/leckhampton.js` and
`public/assets/leckhampton_osm.js` is derived from the sources credited above and stays under their terms: the Open
Government Licence v3.0 for the terrain and the ODbL for the OpenStreetMap data. If you share or adapt that data, keep
those credits.
