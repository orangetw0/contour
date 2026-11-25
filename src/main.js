/* Contour: the page's entry point. Wires the simulation (src/sim) to the world you see (src/world) and to the
   controls, trainer, log, voice and sound (src/app). The simulation runs on its own clock; this file only draws it. */
import * as THREE from 'three';
import { $, query } from './util/dom.js';
import { smooth } from './util/noise.js';
import { COURSE, COURSE_NAMES, XMAS, SCENERY, START, real, line, mkPose } from './course/index.js';
import { scene, camera, composer, sun, sunDir, hazeCol, st0, uTime, uMeadow, rainU, wx, setWeather, stepWeather,
  chunks, rays, lens, rig, drawHeadUnit, LAB } from './world/world.js';
import { createRider, stepRider } from './sim/rider.js';
import { createLoop } from './sim/loop.js';
import { loadProfile, bodyOf } from './sim/profile.js';
import { units } from './sim/units.js';
import { initTrainer } from './app/trainer.js';
import { initLog } from './app/log.js';
import { initVoice } from './app/voice.js';
import { initAudio, updateAudio } from './app/audio.js';

const V3 = THREE.Vector3, { LEN, at } = line;

/* ---------- rider and simulation clock ---------- */
const profile = loadProfile(localStorage);
const unit = units(query.get('units') || profile.units);
const rider = createRider({ s: START, body: bodyOf(profile) });
const cruise = SCENERY !== null ? 5 : null;                    // scenery mode: a steady 18 km/h, whatever the gradient
const loop = createLoop(h => stepRider(rider, line, h, { cruise }));
// Browsers stop drawing a hidden tab, and slow its timers. A worker's timer keeps going, so the ride does too.
try {
  const ticker = new Worker(new URL('./sim/ticker.worker.js', import.meta.url), { type: 'module' });
  ticker.onmessage = () => { if (document.hidden) loop.advance(performance.now()); };
} catch (err) { setInterval(() => { if (document.hidden) loop.advance(performance.now()); }, 250); }

/* ---------- controls: keys, slider, buttons ---------- */
const skip = m => { rider.s = (((rider.s + m) % LEN) + LEN) % LEN; };
const setTarget = w => { rider.target = Math.min(900, Math.max(0, w)); $('pwr').value = rider.target; };
addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') setTarget(rider.target + 10);
  if (e.key === 'ArrowDown') setTarget(rider.target - 10);
  if (e.key === 'ArrowRight') skip(250);
  if (e.key === 'ArrowLeft') skip(-250);
});
$('pwr').addEventListener('input', e => { rider.target = +e.target.value; });
$('skip').addEventListener('click', () => skip(250));
$('course').textContent = 'Course: ' + COURSE_NAMES[COURSE];
$('course').addEventListener('click', () => { location.search = real ? '' : '?course=leckhampton'; });
$('h-sp-u').textContent = unit.speedLabel; $('h-di-u').textContent = unit.distanceLabel;

// hide everything on screen, leaving only the ride: the button, the H key, or by voice. H, a click, or "show" brings it back.
const setClean = hide => document.body.classList.toggle('clean', hide);
const isClean = () => document.body.classList.contains('clean');
$('clean').addEventListener('click', e => { e.stopPropagation(); setClean(true); });
addEventListener('click', () => { if (isClean()) setClean(false); });
addEventListener('keydown', e => { if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !e.altKey) setClean(!isClean()); });

const trainer = initTrainer({ rider, setTarget });
initLog({ rider, course: COURSE, unit });
initVoice({ trainer, setWeather, skip, setClean, xmas: XMAS, lab: LAB });
initAudio();

// for checking from the console: window.ride.s, .goNear(x, z), .weather(name), .built
window.ride = rider;
Object.assign(rider, {
  haze: hazeCol, built: st0, weather: (n, i) => setWeather(n, i),
  goNear: (x, z) => { const n = line.nearestS(x, z); rider.s = Math.max(0, n.s - 60); return Math.round(n.gap); },
});

/* ---------- drawing ---------- */
const clock = new THREE.Clock();
const pose = mkPose(), ahead = mkPose(), probe = mkPose(), look = new V3(), sunNdc = new V3(), fwd = new V3();
let lean = 0, phase = 0, huT = 0, first = true;
// scenery mode's weather, in order, and how many seconds each one stays
const SCENE_PLAN = XMAS ? [['snow', 280], ['mist', 100], ['snow', 180], ['golden', 95]] : [['golden', 200], ['mist', 110], ['rain', 130], ['overcast', 70], ['golden', 90]];
let scene_t = 0, scene_i = 0;
if (SCENERY !== null) { setClean(true); rider.target = rider.power = 90; if (SCENERY === 'nobars') rig.visible = false; }

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  uTime.value += dt;
  loop.advance(performance.now());
  const v = rider.v, s = rider.s + v * loop.leftover();        // draw a little ahead of the last step, so motion stays smooth

  if (SCENERY !== null) {
    scene_t += dt;
    if (scene_t >= SCENE_PLAN[scene_i][1]) { scene_t = 0; scene_i = (scene_i + 1) % SCENE_PLAN.length; setWeather(SCENE_PLAN[scene_i][0]); }
  }

  // camera: follow the lane, look down the road, lean into bends, rock with the pedals
  at(s, pose); at(s + 9, ahead); at(s + 4, probe);
  uMeadow.value.set(pose.p.x + pose.t.x * 78, pose.p.z + pose.t.z * 78);      // most of the meadow sits in front of you
  const kappa = -(pose.t.z * probe.t.x - pose.t.x * probe.t.z) / 4;
  lean += (Math.atan(v * v * kappa / 9.81) * 0.55 - lean) * Math.min(1, dt * 3);
  const effort = Math.min(1, rider.power / 300);
  phase += dt * Math.PI * 2 * (rider.power > 5 ? 60 + Math.min(40, rider.power / 8) : 0) / 60;
  const sway = Math.sin(phase);
  camera.position.copy(pose.p).addScaledVector(pose.r, rider.lane + sway * 0.004 * effort);
  camera.position.y += 1.52;
  look.copy(ahead.p).addScaledVector(ahead.r, rider.lane); look.y += 0.3;
  camera.lookAt(look);
  camera.rotateZ(-lean);
  const fov = 62 + Math.min(v, 20) * 0.75;
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  stepWeather(dt);
  rainU.uVel.value.copy(pose.t).multiplyScalar(v);

  // sun shadow box travels with the rider, pushed forward into the view
  sun.target.position.copy(pose.p).addScaledVector(pose.t, 70);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 350);
  let built = false;
  for (const c of chunks) {
    const d2 = c.c.distanceToSquared(camera.position);
    if (d2 < 230 * 230) { if (!c.mesh && !built) { c.mesh = c.build(); built = true; } }
    else if (c.mesh && d2 > 330 * 330) { scene.remove(c.mesh); c.mesh.dispose(); c.mesh = null; }
  }

  sunNdc.copy(camera.position).addScaledVector(sunDir, 1000).project(camera);
  rays.uniforms.uSunUv.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
  rays.uniforms.uAmt.value = 0.25 * wx.rays * smooth(0.1, 0.6, camera.getWorldDirection(fwd).dot(sunDir));
  lens.uniforms.uSpeed.value = Math.min(1, v / 22);
  lens.uniforms.uTime.value = uTime.value; lens.uniforms.uRain.value = wx.rain; lens.uniforms.uPaint.value = wx.paint;
  updateAudio(v, wx.rain);

  huT -= dt;
  if (huT <= 0) {
    huT = 0.25;
    drawHeadUnit(unit.speed(v), unit.speedLabel, rider.power);
    $('h-pw').textContent = rider.power.toFixed(0);
    $('h-sp').textContent = unit.speed(v).toFixed(1);
    $('h-gr').textContent = (rider.grade >= 0 ? '+' : '') + rider.grade.toFixed(1);
    $('h-di').textContent = unit.distance(rider.dist).toFixed(2);
  }

  composer.render();
  if (first) { first = false; $('loading').style.opacity = 0; setTimeout(() => $('loading').remove(), 900); }
  requestAnimationFrame(frame);
}
frame();
