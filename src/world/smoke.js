import { real, demH } from '../course/index.js';
import { rnd } from '../util/noise.js';
import * as THREE from 'three';
import { st0 } from './shared.js';
import { meshH } from './terrain.js';
import { uTime } from './sky.js';
import { uCloudHaze } from './clouds.js';
import { scene } from './renderer.js';

/* ---------- smoke from the quarry workings on the scarp (real courses) ---------- */
const uPx = { value: innerHeight * Math.min(devicePixelRatio, 2) / (2 * Math.tan(0.6)) };      // metres to pixels at 1 m
if (real && real.quarry) {
  const [qx, qz] = real.quarry, cands = [], src = [];
  for (let n = 0; n < 400; n++) {
    const x = qx + (rnd() - 0.5) * 520, z = qz + (rnd() - 0.5) * 520;
    cands.push([Math.hypot(demH(x + 10, z) - demH(x - 10, z), demH(x, z + 10) - demH(x, z - 10)), x, z]);
  }
  cands.sort((a, b) => b[0] - a[0]);                     // the steepest ground nearby is the quarry face
  for (const [, x, z] of cands) { if (src.length < 3 && src.every(s => Math.hypot(s[0] - x, s[1] - z) > 70)) src.push([x, z]); }
  const PUFFS = 46, n = src.length * PUFFS, a = new Float32Array(n * 3), ph = new Float32Array(n);
  src.forEach(([x, z], k) => { for (let i = 0; i < PUFFS; i++) { a.set([x, meshH(x, z) + 1.5, z], (k * PUFFS + i) * 3); ph[k * PUFFS + i] = rnd(); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const smoke = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime, uPx, uCol: uCloudHaze },
    vertexShader: `uniform float uTime, uPx; attribute float aPh; varying float vA;
      void main(){
        float age = fract(uTime * 0.035 + aPh);                                   // each puff lives about half a minute
        vec3 p = position + vec3(2.2, 0., 1.1) * age * 38.                        // drifts downwind
               + vec3(sin(aPh * 40. + age * 5.) * 3. * age, age * 30. + age * age * 26., cos(aPh * 31. + age * 4.) * 3. * age);
        vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = (5. + age * 26.) * uPx / -mv.z;
        vA = smoothstep(0., 0.08, age) * (1. - age) * 0.5;
      }`,
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol * 1.05, smoothstep(0.5, 0.15, r) * vA); }'
  }));
  smoke.frustumCulled = false; smoke.renderOrder = 3; scene.add(smoke);
  st0.smoke = src.map(([x, z]) => [Math.round(x), Math.round(z)]);
}

export { uPx };
