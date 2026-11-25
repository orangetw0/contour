import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import * as THREE from 'three';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { renderer, scene, camera } from './renderer.js';
import { hazeLum } from './sky.js';
import { uPx } from './smoke.js';
import './cockpit.js';

/* ---------- lens ---------- */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.6, 3.5);
composer.addPass(bloom);
const rays = new ShaderPass({      // light shafts: smear the bright sky outward from the sun
  uniforms: { tDiffuse: { value: null }, uSunUv: { value: new THREE.Vector2(0.5, 0.5) }, uAmt: { value: 0 }, uThr: { value: hazeLum * 2.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uSunUv; uniform float uAmt, uThr; varying vec2 vUv;
    void main(){
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec2 d = uSunUv - vUv;
      float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      vec3 acc = vec3(0.); float w = 1., tot = 0.;
      for (int i = 0; i < 36; i++) {
        vec2 uv = vUv + d * ((float(i) + j) / 36.) * 0.92;
        float inb = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
        vec3 c = texture2D(tDiffuse, uv).rgb;
        acc += c * smoothstep(uThr, uThr * 2.5, dot(c, vec3(0.3, 0.6, 0.1))) * w * inb;
        tot += w; w *= 0.965;
      }
      gl_FragColor = vec4(base + acc / tot * uAmt, 1.);
    }`
});
composer.addPass(rays);
composer.addPass(new OutputPass());
const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSpeed: { value: 0 }, uRain: { value: 0 }, uPaint: { value: 0 }, uAspect: { value: innerWidth / innerHeight } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uSpeed, uRain, uPaint, uAspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 drops(vec2 uv, float t){            // water on the lens: each drop lands, sits, slides a little and dries
      vec2 off = vec2(0.); float m = 0.;
      for (int L = 0; L < 2; L++) {
        vec2 g = vec2(9. * uAspect, 9.) * (1. + float(L) * 0.7);
        vec2 p = uv * g + float(L) * 17.3, i = floor(p), f = fract(p) - 0.5;
        float h1 = h(i), h2 = h(i + 31.7);
        float life = fract(t * (0.08 + h2 * 0.1) + h1 * 9.);
        float on = step(0.6, h1) * smoothstep(0., 0.04, life) * (1. - smoothstep(0.6, 1., life));
        vec2 d = f - (vec2(h1, h2) - 0.5) * 0.5 + vec2(0., life * 0.14 * h2);
        float R = 0.08 + h2 * 0.1, k = smoothstep(R, R * 0.55, length(d)) * on;
        off -= d * k * 0.9 / g; m += k;
      }
      return vec3(off, m);
    }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    vec3 painted(vec2 uv){                   // rebuild the picture from overlapping dabs of paint
      float ang = floor(vn(uv * vec2(uAspect, 1.) * 2.3) * 5.) * 0.63 + 0.3, ca = cos(ang), sa = sin(ang);     // brush direction changes from patch to patch
      vec2 size = vec2(0.015, 0.0052);
      vec2 p = vec2(ca * uv.x * uAspect + sa * uv.y, -sa * uv.x * uAspect + ca * uv.y) / size;
      float row = floor(p.y); p.x += 0.5 * mod(row, 2.);
      vec2 id = floor(p), jit = (vec2(h(id), h(id + 7.3)) - 0.5) * 0.4, f = fract(p) - 0.5 - jit;
      vec2 c = id + 0.5 + jit; c.x -= 0.5 * mod(row, 2.); c *= size;
      vec3 col = texture2D(tDiffuse, vec2((ca * c.x - sa * c.y) / uAspect, sa * c.x + ca * c.y)).rgb * (0.88 + 0.24 * h(id + 3.1));
      col = mix(col, texture2D(tDiffuse, uv).rgb, 0.3);                         // keep some of the true picture so shapes stay readable
      col *= 1. - 0.22 * smoothstep(0.28, 0.55, length(f));                    // each dab is darker at its edge
      float l = dot(col, vec3(0.3, 0.6, 0.1));
      col = mix(vec3(l), col, 1.4);                                             // richer colour
      return mix(col * vec3(0.82, 0.9, 1.25), col * vec3(1.12, 1.04, 0.86), smoothstep(0.1, 0.6, l));   // blue shadows, warm lights
    }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec2 dir = c * r2 * (0.02 + 0.2 * uSpeed);            // edges streak with speed
      vec3 dr = uRain > 0.01 ? drops(vUv, uTime) * uRain : vec3(0.);
      vec2 uv0 = vUv + dr.xy;
      vec3 col = vec3(0.);
      for (int i = 0; i < 8; i++) col += texture2D(tDiffuse, uv0 - dir * (float(i) / 7.)).rgb;
      col = col / 8. + dr.z * 0.012;
      if (uPaint > 0.01) col = mix(col, painted(uv0), uPaint);
      col *= 1. - smoothstep(0.12, 0.62, r2) * 0.55;        // vignette
      col += (h(vUv * 917. + fract(uTime) * 31.) - 0.5) * 0.035;   // grain
      gl_FragColor = vec4(col, 1.);
    }`
});
composer.addPass(lens);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  lens.uniforms.uAspect.value = innerWidth / innerHeight;
  uPx.value = innerHeight * Math.min(devicePixelRatio, 2) / (2 * Math.tan(0.6));
});

export { composer, rays, lens };
