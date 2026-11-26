/* Contour: the page's entry point. Wires the simulation (src/sim) to the world you see (src/world) and to the
   controls, trainer, log, voice and sound (src/app). The simulation runs on its own clock; this file only draws it. */
import * as THREE from 'three';
import { $, query } from './util/dom.js';
import { smooth } from './util/noise.js';
import { COURSE, COURSE_NAME, XMAS, SCENERY, START, real, line, mkPose } from './course/index.js';
import { initRoutes } from './app/routes.js';
import { scene, camera, composer, sun, sunDir, hazeCol, st0, uTime, uMeadow, rainU, wx, setWeather, stepWeather,
  chunks, rays, lens, rig, drawHeadUnit, LAB } from './world/index.js';
import { meshH } from './world/terrain.js';
import { createRider, stepRider, uTurn } from './sim/rider.js';
import { createRiderView } from './riders/riderView.js';
import { createLoop } from './sim/loop.js';
import { MODELS, REAL } from './sim/physics.js';
import { createRolling, wattsPerKg } from './sim/metrics.js';
import { createRecorder } from './sim/recorder.js';
import { buildSpeedLimit } from './course/speedLimit.js';
import { loadProfile, bodyOf, lookOf } from './sim/profile.js';
import { units } from './sim/units.js';
import { initTrainer } from './app/trainer.js';
import { initLog } from './app/log.js';
import { initVoice } from './app/voice.js';
import { initAudio, updateAudio } from './app/audio.js';
import { initHeart } from './app/heart.js';
import { initSettings } from './app/settings.js';
import { initSave } from './app/save.js';
import { initCompany } from './app/company.js';
import { createBots, stepBot } from './sim/bots.js';
import { draftOf } from './sim/draft.js';

const V3 = THREE.Vector3, { at } = line;

/* ---------- rider and simulation clock ---------- */
let profile = loadProfile(localStorage);
if (query.get('units')) profile = { ...profile, units: query.get('units') === 'imperial' ? 'imperial' : 'metric' };
let unit = units(profile.units);
const model = MODELS[query.get('physics')] || REAL;                // ?physics=legacy: the original ride's rules
const limits = buildSpeedLimit(line, { decel: REAL.brakeDecel, max: REAL.maxSpeed });
const rider = createRider({ s: START, v: model === REAL ? 0 : 6, body: bodyOf(profile) });
const cruise = SCENERY !== null ? 5 : null;                    // scenery mode: a steady 18 km/h, whatever the gradient
const HZ = 60, power3s = createRolling(3, HZ), here = mkPose();
const recorder = createRecorder({ startUnix: Math.floor(Date.now() / 1000), geo: real ? real.geo : null });
let paused = false;                                            // P: stop the clock, the rider and the recording
// other riders: ?bots=N sets how many (0 for none); scenery mode rides alone
const botCount = SCENERY !== null ? 0 : Math.max(0, Math.min(40, query.get('bots') === null ? 14 : +query.get('bots') || 0));
const bots = botCount ? createBots(line, { humans: botCount, near: START }) : [];
const everyone = [rider, ...bots], shelter = { drag: 1, from: null, gap: Infinity }, botShelter = { drag: 1, from: null, gap: Infinity };
let company = null;
const loop = createLoop(h => {
  if (paused) return;
  if (bots.length) {
    rider.drag = draftOf(rider, everyone, line, shelter).drag;
    for (const b of bots) { draftOf(b, everyone, line, botShelter); b.drag = botShelter.drag; b.draftFrom = botShelter.from; }
    for (const b of bots) stepBot(b, everyone, line, h, { model, limits });
    if (company) company.talk(h);
  }
  stepRider(rider, line, h, { model, limits, cruise });
  power3s.push(rider.target);
  if (SCENERY === null) recorder.step(rider, at(rider.s, here).p, h);
}, { hz: HZ });
// Browsers stop drawing a hidden tab, and slow its timers. A worker's timer keeps going, so the ride does too.
try {
  const ticker = new Worker(new URL('./sim/ticker.worker.js', import.meta.url), { type: 'module' });
  ticker.onmessage = () => { if (document.hidden) loop.advance(performance.now()); };
} catch (err) { setInterval(() => { if (document.hidden) loop.advance(performance.now()); }, 250); }

/* ---------- controls: keys, slider, buttons ---------- */
const skip = m => { rider.s = line.wrap(rider.s + rider.dir * m); };
const setTarget = w => { rider.target = Math.min(900, Math.max(0, w)); $('pwr').value = rider.target; };
addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') setTarget(rider.target + 10);
  if (e.key === 'ArrowDown') setTarget(rider.target - 10);
  if (e.key === ']' || e.key === 'PageUp') skip(250);
  if (e.key === '[' || e.key === 'PageDown') skip(-250);
  if (e.key === 'u' || e.key === 'U') uTurn(rider);
  if (e.key === 'p' || e.key === 'P') setPaused(!paused);
  if (e.key === 'v' || e.key === 'V') setView(view === 'third' ? 'first' : 'third');
});
// steering: hold left or right (or A and D) to move across your lane
const held = new Set(), STEER = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
const steerFromKeys = () => { let x = 0; for (const k of held) x += STEER[k]; rider.steer = Math.max(-1, Math.min(1, x)); };
addEventListener('keydown', e => { if (e.key in STEER && !e.metaKey && !e.ctrlKey) { held.add(e.key); steerFromKeys(); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
addEventListener('keyup', e => { if (held.delete(e.key)) steerFromKeys(); });
addEventListener('blur', () => { held.clear(); steerFromKeys(); });
$('uturn').addEventListener('click', () => uTurn(rider));
const setPaused = on => { paused = on; $('pause').textContent = on ? 'Resume' : 'Pause'; $('pause').classList.toggle('on', on); };
$('pause').addEventListener('click', () => setPaused(!paused));

// two views: behind your rider, or from the saddle. Kept in this browser.
const VIEW_KEY = 'contour-view';
let view = 'third';
try { if (localStorage.getItem(VIEW_KEY) === 'first') view = 'first'; } catch {}
if (SCENERY !== null || query.get('view') === 'first') view = 'first';
if (query.get('view') === 'third') view = 'third';
const riderView = createRiderView(scene);
function setView(v) {
  view = v; $('view').textContent = v === 'third' ? 'View: behind' : 'View: saddle';
  try { localStorage.setItem(VIEW_KEY, v); } catch {}
}
setView(view);
$('view').addEventListener('click', () => setView(view === 'third' ? 'first' : 'third'));
$('pwr').addEventListener('input', e => { rider.target = +e.target.value; });
$('skip').addEventListener('click', () => skip(250));
$('course').textContent = 'Route: ' + COURSE_NAME;
const showUnits = () => { $('h-sp-u').textContent = unit.speedLabel; $('h-di-u').textContent = unit.distanceLabel; };
showUnits();

// hide everything on screen, leaving only the ride: the button, the H key, or by voice. H, a click, or "show" brings it back.
const setClean = hide => document.body.classList.toggle('clean', hide);
const isClean = () => document.body.classList.contains('clean');
$('clean').addEventListener('click', e => { e.stopPropagation(); setClean(true); });
addEventListener('click', () => { if (isClean()) setClean(false); });
addEventListener('keydown', e => { if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !e.altKey) setClean(!isClean()); });

const trainer = initTrainer({ rider, setTarget });
initLog({ rider, course: COURSE, name: COURSE_NAME, unit: () => unit });
initRoutes({ current: COURSE, unit: () => unit });
initHeart({ rider });
initSettings({ profile, onChange: p => { profile = p; unit = units(p.units); rider.body = bodyOf(p); showUnits(); riderView.dress(lookOf(p)); } });
riderView.dress(lookOf(profile));
initSave({ recorder, course: COURSE_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ride' });
rider.name = 'you';
if (bots.length) company = initCompany({ scene, camera, line, bots, rider, unit: () => unit,
  onJoin: p => { Object.assign(rider, { dir: p.dir, s: line.wrap(p.s - p.dir * 4), lane: p.lane, v: p.v, uturn: 0 }); } });
else $('pacerbtn').remove();
initVoice({ trainer, setWeather, skip, setClean, xmas: XMAS, lab: LAB });
initAudio();

// for checking from the console: window.ride.s, .goNear(x, z), .weather(name), .built, .recorder
window.ride = rider;
// how far the ground stands above the tarmac at its worst, in metres (negative: the road is clear everywhere)
rider.groundOver = () => { let worst = -Infinity; for (let i = 0; i < line.N; i++) for (const o of [-3.5, 0, 3.5]) worst = Math.max(worst, meshH(line.P[i].x + line.R[i].x * o, line.P[i].z + line.R[i].z * o) - line.P[i].y); return worst; };
Object.assign(rider, {
  haze: hazeCol, built: st0, recorder, bots, pause: on => setPaused(on), weather: (n, i) => setWeather(n, i),
  goNear: (x, z) => { const n = line.nearestS(x, z); rider.s = Math.max(0, n.s - 60); return Math.round(n.gap); },
});

/* ---------- drawing ---------- */
const clock = new THREE.Clock();
const pose = mkPose(), ahead = mkPose(), probe = mkPose(), behind = mkPose(), look = new V3(), sunNdc = new V3(), fwd = new V3();
const camPos = new V3(), camLook = new V3(), wantPos = new V3();
let camSet = false;
let lean = 0, phase = 0, huT = -1e9, first = true;
// scenery mode's weather, in order, and how many seconds each one stays
const SCENE_PLAN = XMAS ? [['snow', 280], ['mist', 100], ['snow', 180], ['golden', 95]] : [['golden', 200], ['mist', 110], ['rain', 130], ['overcast', 70], ['golden', 90]];
let scene_t = 0, scene_i = 0;
if (SCENERY !== null) { setClean(true); rider.target = rider.power = 90; }

function frame() {
  const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05);
  uTime.value += dt;
  const now = performance.now();
  loop.advance(now);
  const v = rider.v, s = rider.s + v * loop.leftover();        // draw a little ahead of the last step, so motion stays smooth

  if (SCENERY !== null) {
    scene_t += dt;
    if (scene_t >= SCENE_PLAN[scene_i][1]) { scene_t = 0; scene_i = (scene_i + 1) % SCENE_PLAN.length; setWeather(SCENE_PLAN[scene_i][0]); }
  }

  // the road here, a little ahead, and a little behind, all in the rider's direction of travel
  const d = rider.dir;
  at(s, pose); at(s + d * 9, ahead); at(s + d * 4, probe);
  uMeadow.value.set(pose.p.x + d * pose.t.x * 78, pose.p.z + d * pose.t.z * 78);      // most of the meadow sits in front of you
  const kappa = -(pose.t.z * probe.t.x - pose.t.x * probe.t.z) / 4;                   // positive in a right-hand bend
  lean += (Math.atan(v * v * kappa / 9.81) * 0.55 - lean) * Math.min(1, dt * 3);
  const effort = Math.min(1, rider.power / 300);
  phase += dt * Math.PI * 2 * (rider.cadence != null ? rider.cadence : rider.power > 5 ? 60 + Math.min(40, rider.power / 8) : 0) / 60;
  const sway = Math.sin(phase), third = view === 'third' && riderView.ready;

  // camera: from the saddle, or following a few metres behind the rider along the road they have just ridden
  if (third) {
    at(s - d * 5.2, behind);
    wantPos.copy(behind.p).addScaledVector(behind.r, d * rider.lane * 0.9); wantPos.y += 2.05;
    look.copy(pose.p).addScaledVector(pose.r, d * rider.lane).addScaledVector(pose.t, d * 4); look.y += 1.1;
  } else {
    wantPos.copy(pose.p).addScaledVector(pose.r, d * (rider.lane + sway * 0.004 * effort)); wantPos.y += 1.52;
    look.copy(ahead.p).addScaledVector(ahead.r, d * rider.lane); look.y += 0.3;
  }
  // follow closely; swing round gently after a U-turn; jump straight there after a skip
  const k = !camSet || wantPos.distanceTo(camPos) > 40 ? 1 : 1 - Math.exp(-Math.min(rawDt, 0.5) * (rider.uturn > 0 ? 2.5 : third ? 12 : 60));
  camPos.lerp(wantPos, k); camLook.lerp(look, k); camSet = true;
  camera.position.copy(camPos);
  if (third) {                           // on a hairpin the bank must not swallow the camera or hide the rider
    let y = Math.max(camPos.y, meshH(camPos.x, camPos.z) + 1.3);
    for (const t of [0.2, 0.4, 0.6, 0.8]) { const g = meshH(camPos.x + (camLook.x - camPos.x) * t, camPos.z + (camLook.z - camPos.z) * t) + 0.5; y = Math.max(y, Math.min(camLook.y + 9, (g - camLook.y * t) / (1 - t))); }
    camera.position.y = y;
  }
  camera.lookAt(camLook);
  if (!third) camera.rotateZ(-lean);
  const fov = third ? 52 + Math.min(v, 20) * 0.5 : 62 + Math.min(v, 20) * 0.75;
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  rig.visible = !third && SCENERY !== 'nobars';                 // the handlebars belong to the saddle view
  riderView.rig.visible = third;
  if (third) riderView.update(rider, pose, lean * 1.5, paused ? 0 : dt);
  if (company) company.draw(paused ? 0 : dt);

  stepWeather(dt);
  rainU.uVel.value.copy(pose.t).multiplyScalar(v * d);

  // sun shadow box travels with the rider, pushed forward into the view
  sun.target.position.copy(pose.p).addScaledVector(pose.t, 70 * d);
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

  if (now - huT >= 250) {                                        // the numbers refresh four times a second
    huT = now;
    drawHeadUnit(unit.speed(v), unit.speedLabel, rider.target);
    $('h-pw').textContent = rider.target.toFixed(0);
    $('h-p3').textContent = power3s.avg.toFixed(0);
    $('h-wk').textContent = wattsPerKg(power3s.avg, rider.body.riderKg).toFixed(1);
    $('h-hr-box').hidden = rider.hr == null; if (rider.hr != null) $('h-hr').textContent = rider.hr.toFixed(0);
    $('h-cd-box').hidden = rider.cadence == null; if (rider.cadence != null) $('h-cd').textContent = rider.cadence.toFixed(0);
    $('h-dr-box').hidden = rider.drag > 0.97; $('h-dr').textContent = Math.round((1 - rider.drag) * 100);
    $('h-sp').textContent = unit.speed(v).toFixed(1);
    $('h-gr').textContent = (rider.grade >= 0 ? '+' : '') + rider.grade.toFixed(1);
    $('h-di').textContent = unit.distance(rider.dist).toFixed(2);
  }

  composer.render();
  if (first) { first = false; $('loading').style.opacity = 0; setTimeout(() => $('loading').remove(), 900); }
  requestAnimationFrame(frame);
}
frame();
