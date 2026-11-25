import { V3 } from './shared.js';
import * as THREE from 'three';
import { rnd } from '../util/noise.js';
import { uTime, uCloud, sunFlat, uMote, hazeLum } from './sky.js';
import { scene } from './renderer.js';
import './buildings.js';

/* ---------- clouds and dust motes ---------- */
const uLid = { value: 0 }, uCloudLit = { value: new V3() }, uCloudDark = { value: new V3() }, uCloudHaze = { value: new V3() };
{
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime, uCloud, uLid, uSun: { value: sunFlat }, uHaze: uCloudHaze, uLit: uCloudLit, uDark: uCloudDark },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }',
    fragmentShader: `
      uniform float uTime, uCloud, uLid; uniform vec3 uSun, uHaze, uLit, uDark; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 6; i++) { s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      float dens(vec2 p){ return smoothstep(0.46, 0.8, fbm(p)); }
      void main(){
        vec2 p = vW.xz * 0.00034 + uTime * 0.004;
        float d = dens(p), d2 = dens(p + uSun.xz * 0.07);
        vec3 col = mix(uDark, uLit, clamp(0.5 + (d - d2) * 1.7, 0., 1.));     // sun-side edges glow
        float fade = 1. - smoothstep(3200., 8500., length(vW.xz - cameraPosition.xz));
        gl_FragColor = vec4(mix(uHaze, col, 0.25 + 0.75 * fade), d * fade * 0.92 * uCloud * mix(1., smoothstep(0.25, 0.6, (vW.y - cameraPosition.y) / length(vW - cameraPosition)), uLid));
      }`
  }));
  clouds.position.y = 1400; clouds.frustumCulled = false; clouds.renderOrder = 2; scene.add(clouds);

  const n = 700, a = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) a[i] = rnd() * 40;
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const motes = new THREE.Points(mg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uMote, uCol: { value: new V3(2.4, 1.8, 1.1).multiplyScalar(hazeLum) } },
    vertexShader: `uniform float uTime; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * 0.3 + position.y) * 0.6, uTime * 0.08, cos(uTime * 0.25 + position.x) * 0.6);
        p = mod(p - cameraPosition, 40.) - 20. + cameraPosition;                // the cloud of motes travels with the rider
        vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        float d = -mv.z; gl_PointSize = clamp(60. / d, 1., 4.);
        vA = smoothstep(20., 12., d) * smoothstep(0.6, 3., d);
      }`,
    fragmentShader: 'uniform vec3 uCol; uniform float uMote; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol, smoothstep(0.5, 0.1, r) * vA * 0.12 * uMote); }'
  }));
  motes.frustumCulled = false; motes.renderOrder = 3; scene.add(motes);
}

export { uCloudHaze, uLid, uCloudLit, uCloudDark };
