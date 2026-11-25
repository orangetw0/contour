import * as THREE from 'three';
import { V3 } from './shared.js';
import { rnd } from '../util/noise.js';
import { SCENERY, XMAS } from '../course/index.js';
import { hazeLum, uTime, rainU, hazeCol, envScene, sky, pmrem, env, sun, hemi, uCloud, uMote, uSunAmt } from './sky.js';
import { scene, camera, renderer } from './renderer.js';
import { uPx } from './smoke.js';
import { uLid, uCloudLit, uCloudDark, uCloudHaze } from './clouds.js';
import { terrainMat } from './terrain.js';
import { road } from './road.js';

/* ---------- weather ---------- */
// An overcast lid: a dome that greys out the clear sky by a chosen amount.
const dome = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, depthWrite: false,
  uniforms: { uH: { value: new V3() }, uZ: { value: new V3() }, uA: { value: 0 }, uPaint: { value: 0 }, uGain: { value: hazeLum * 1.5 }, uTime },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec3 uH, uZ; uniform float uA, uPaint, uGain, uTime; varying vec3 vDir;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
    vec3 starry(vec3 d){                                  // a night sky in thick, flowing strokes, after Van Gogh
      vec2 p = d.xz / (1.15 + d.y) * 1.6;
      float t = uTime * 0.03;
      vec2 q = p - vec2(0.25, -0.35); float r = length(q), tw = 2.6 * exp(-r * r * 6.);       // the great swirl
      p = mat2(cos(tw), -sin(tw), sin(tw), cos(tw)) * q + vec2(0.25, -0.35);
      vec2 w = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 + 5.2 - t));
      float f = fbm(p * 2.2 + w * 2.4), band = 0.5 + 0.5 * sin(f * 46. + w.x * 6.);           // bands of paint along the flow
      vec3 col = mix(vec3(0.03, 0.07, 0.28), vec3(0.10, 0.25, 0.72), band);
      col = mix(col, vec3(0.45, 0.62, 0.9), smoothstep(0.62, 0.9, fbm(p * 3.1 - w * 2.)) * band);
      for (int i = 0; i < 11; i++) {                      // stars as glowing discs with rings
        vec2 s = vec2(h(vec2(float(i), 1.7)), h(vec2(float(i), 9.1))) * 2.6 - 1.3;
        float dd = length(p - s), rad = 0.07 + 0.06 * h(vec2(float(i), 4.));
        col = mix(col, vec3(1., 0.85, 0.25) * (0.6 + 0.4 * sin(dd * 160. - uTime * 1.5)), exp(-dd * dd / (rad * rad)) * 0.85);
        col += vec3(1., 0.95, 0.6) * smoothstep(rad * 0.28, 0., dd);
      }
      vec2 m = p - vec2(-0.85, 0.6); float md = length(m);                                     // a crescent moon in its halo
      col = mix(col, vec3(1., 0.8, 0.2) * (0.65 + 0.35 * sin(md * 120. - uTime)), exp(-md * md / 0.035) * 0.9);
      col += vec3(1.2, 0.9, 0.3) * smoothstep(0.075, 0.06, md) * smoothstep(0.05, 0.065, length(m - vec2(0.03, 0.012)));
      return col;
    }
    void main(){
      vec3 col = mix(uH, uZ, smoothstep(0.2, 0.9, vDir.y));
      if (uPaint > 0.01) col = mix(col, starry(normalize(vDir)) * uGain, uPaint);
      gl_FragColor = vec4(col, uA);
    }`
}));
dome.renderOrder = 1; dome.frustumCulled = false; scene.add(dome);

// Rain: short streaks in a box that travels with the rider; they slant against your speed.
const rainMesh = (() => {
  const n = 16000, a = new Float32Array(n * 6), e = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const x = rnd() * 30, y = rnd() * 30, z = rnd() * 30; a.set([x, y, z, x, y, z], i * 6); e[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(e, 1));
  const m = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: rainU,
    vertexShader: `uniform float uTime; uniform vec3 uVel; attribute float aEnd; varying float vA;
      void main(){
        vec3 fall = vec3(1.5, -13., 0.8);
        vec3 p = mod(position + fall * uTime - cameraPosition, 30.) - 15. + cameraPosition;
        p += (fall - uVel) * 0.03 * aEnd;
        vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        vA = smoothstep(15., 9., -mv.z) * (1. - aEnd * 0.6);
      }`,
    fragmentShader: 'uniform vec3 uCol; uniform float uRain; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * 0.3 * uRain); }'
  }));
  m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m);
  return m;
})();

// Snow: soft flakes drifting down in a box that travels with the rider.
const uSnow = { value: 0 };
const snowMesh = (() => {
  const n = 9000, a = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) a[i] = rnd() * 40;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime, uPx, uSnow, uCol: { value: new V3(1, 1.02, 1.08).multiplyScalar(hazeLum * 2.4) } },
    vertexShader: `uniform float uTime, uPx; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * 0.6 + position.y * 1.7) * 0.5 + uTime * 0.45, -uTime * 1.5, cos(uTime * 0.5 + position.x * 1.3) * 0.5);
        p = mod(p - cameraPosition, 40.) - 20. + cameraPosition;
        vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        float d = -mv.z; gl_PointSize = clamp(0.05 * uPx / d, 1.3, 9.);
        vA = smoothstep(20., 13., d) * smoothstep(0.4, 1.6, d);
      }`,
    fragmentShader: 'uniform vec3 uCol; uniform float uSnow; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol, smoothstep(0.5, 0.15, r) * vA * 0.8 * uSnow); }'
  }));
  m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m);
  return m;
})();

const hz = [hazeCol.r, hazeCol.g, hazeCol.b], grey = (r, g, b) => [r * hazeLum, g * hazeLum, b * hazeLum];
const warmLit = grey(2.6, 1.75, 1.05), warmDark = grey(0.42, 0.45, 0.58);
const WEATHER = {
  golden:   { sun: 10,  sunCol: [1, 0.69, 0.44], hemi: 2.2, fog: 0.0007, fogCol: hz, dome: 0, domeH: hz, domeZ: hz,
              cloud: 1, cLit: warmLit, cDark: warmDark, mote: 1, rays: 1, rain: 0, rough: 1, tint: 1, ground: 1, paint: 0, expo: 0.33 },
  overcast: { sun: 1.5, sunCol: [1, 1, 1], hemi: 7, fog: 0.0008, fogCol: grey(0.8, 0.83, 0.88), dome: 1, domeH: grey(0.8, 0.83, 0.88), domeZ: grey(0.5, 0.53, 0.6),
              cloud: 1, cLit: grey(0.98, 1, 1.04), cDark: grey(0.5, 0.53, 0.6), mote: 0, rays: 0, rain: 0, rough: 0.9, tint: 0.9, ground: 0.95, paint: 0, expo: 0.5 },
  rain:     { sun: 0, sunCol: [1, 1, 1], hemi: 5.3, fog: 0.0016, fogCol: grey(0.5, 0.54, 0.6), dome: 1, domeH: grey(0.5, 0.54, 0.6), domeZ: grey(0.36, 0.39, 0.45),
              cloud: 1, cLit: grey(0.56, 0.6, 0.66), cDark: grey(0.3, 0.33, 0.39), mote: 0, rays: 0, rain: 1, rough: 0.32, tint: 0.55, ground: 0.72, paint: 0, expo: 0.5 },
  mist:     { sun: 5,   sunCol: [1, 0.8, 0.6], hemi: 2.6, fog: 0.0075, fogCol: hz.map(v => v * 0.95), dome: 0.6, domeH: hz, domeZ: hz.map(v => v * 0.8),
              cloud: 0.3, cLit: warmLit, cDark: warmDark, mote: 1, rays: 1.8, rain: 0, rough: 0.7, tint: 0.85, ground: 0.95, paint: 0, expo: 0.33 },
  starry:   { sun: 5, sunCol: [1, 0.93, 0.74], hemi: 3.2, fog: 0.0005, fogCol: grey(0.16, 0.26, 0.52), dome: 1, domeH: grey(0.16, 0.26, 0.52), domeZ: grey(0.05, 0.1, 0.4),
              cloud: 0, cLit: warmLit, cDark: warmDark, mote: 5, rays: 0, rain: 0, rough: 0.95, tint: 1, ground: 1, paint: 1, expo: 0.5 }
};
// Christmas dusk: the last low sun, a blue sky closing in, light snow falling.
WEATHER.snow = { sun: 5, sunCol: [1, 0.64, 0.46], hemi: 2.5, fog: 0.0015, fogCol: [hz[0] * 0.8, hz[1] * 0.86, hz[2] * 1.05], dome: 0.4, domeH: hz, domeZ: grey(0.26, 0.33, 0.62),
                 cloud: 0.8, cLit: grey(1.7, 1.2, 1.05), cDark: grey(0.34, 0.4, 0.62), mote: 0, rays: 0.8, rain: 0, rough: 0.5, tint: 0.62, ground: 1, paint: 0, expo: 0.38, snow: 1 };
for (const k in WEATHER) WEATHER[k].snow ??= 0;
const wx = JSON.parse(JSON.stringify(WEATHER.golden));
let wxTarget = WEATHER.golden;
function setWeather(name, instant) {
  if (!WEATHER[name]) return;
  wxTarget = WEATHER[name];
  if (instant) Object.assign(wx, JSON.parse(JSON.stringify(wxTarget)));
  // re-bake what the road and bike reflect, using the new sky
  const u = dome.material.uniforms, was = [u.uA.value, u.uH.value.clone(), u.uZ.value.clone(), u.uPaint.value];
  u.uA.value = wxTarget.dome; u.uH.value.fromArray(wxTarget.domeH); u.uZ.value.fromArray(wxTarget.domeZ); u.uPaint.value = wxTarget.paint;
  envScene.add(sky, dome);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 20000);
  scene.add(sky, dome);
  env.rt.dispose(); env.rt = rt; scene.environment = rt.texture;
  u.uA.value = was[0]; u.uH.value.copy(was[1]); u.uZ.value.copy(was[2]); u.uPaint.value = was[3];
  document.querySelectorAll('#wx button').forEach(b => b.classList.toggle('on', b.dataset.w === name));
}
function stepWeather(dt) {
  const k = Math.min(1, dt * (SCENERY !== null ? 0.07 : 1.2));
  for (const key in wx) {
    const a = wx[key], b = wxTarget[key];
    if (Array.isArray(a)) for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * k;
    else wx[key] += (b - a) * (key === 'dome' ? Math.min(1, dt * (SCENERY !== null ? 0.25 : 4)) : k);      // the cloud lid closes fast, so the sun doesn't linger
  }
  sun.intensity = wx.sun; sun.color.setRGB(wx.sunCol[0], wx.sunCol[1], wx.sunCol[2], THREE.SRGBColorSpace);
  hemi.intensity = wx.hemi;
  scene.fog.density = wx.fog; scene.fog.color.fromArray(wx.fogCol);
  const u = dome.material.uniforms; u.uA.value = wx.dome; u.uH.value.fromArray(wx.domeH); u.uZ.value.fromArray(wx.domeZ); u.uPaint.value = wx.paint;
  dome.position.copy(camera.position);
  uCloud.value = wx.cloud; uMote.value = wx.mote; uLid.value = wx.dome; uSunAmt.value = Math.min(1, wx.sun / 10);
  uCloudLit.value.fromArray(wx.cLit); uCloudDark.value.fromArray(wx.cDark); uCloudHaze.value.fromArray(wx.fogCol);
  terrainMat.color.setScalar(wx.ground);                                          // wet ground is darker
  rainU.uRain.value = wx.rain; rainMesh.visible = wx.rain > 0.01;
  uSnow.value = wx.snow; snowMesh.visible = wx.snow > 0.01;
  road.material.roughness = wx.rough; road.material.color.setScalar(wx.tint);     // wet tarmac: darker and glossier
  renderer.toneMappingExposure = wx.expo;
}
document.querySelectorAll('#wx button').forEach(b => b.addEventListener('click', () => setWeather(b.dataset.w)));
// Starry is still being worked on: it only appears on the local copy, not the hosted site.
const LAB = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
if (!LAB) document.querySelector('#wx [data-w="starry"]')?.remove();
if (!XMAS) document.querySelector('#wx [data-w="snow"]')?.remove(); else setWeather('snow', true);
addEventListener('keydown', e => { const n = ['golden', 'overcast', 'rain', 'mist', LAB && 'starry'][+e.key - 1]; if (n) setWeather(n); });

export { wx, setWeather, stepWeather, LAB };
