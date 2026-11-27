import { nearRoad, XMAS, real } from '../course/index.js';
import { LOOK } from './look.js';
import { smooth, fbm, rnd } from '../util/noise.js';
import * as THREE from 'three';
import { TW, tGeo, tPos, H, TS, TC, TG, tFine } from './terrain.js';
import { stamps } from './pasture.js';
import { tuftGeo, grassMat } from './verge.js';
import { uTime, uMeadow } from './sky.js';
import { scene } from './renderer.js';

/* ---------- meadow: a field of grass that travels with the rider and reads the terrain's height ---------- */
{
  const data = new Float32Array(TW * TW * 4), mix = tGeo.attributes.aMix.array;
  const winter = LOOK.season === 'winter' || LOOK.snowy, [lr, lg, lb] = real ? LOOK.blade : [1, 1, 1];
  for (let k = 0; k < TW * TW; k++) {             // per terrain vertex: height, distance to road, rock/snow, dryness (in winter: rock, and how deep the snow lies)
    // (where the ground by the road is drawn finer than this grid, its height here would be wrong: tFine marks those corners, and the meadow keeps off them as it keeps off the road)
    const nr = nearRoad(tPos[k * 3], tPos[k * 3 + 2]);
    data.set([H[k], tFine[k] ? 0 : nr ? Math.min(nr.d, 100) : 100, winter ? mix[k * 2] : Math.max(mix[k * 2], mix[k * 2 + 1]), winter ? Math.min(1, mix[k * 2 + 1]) : smooth(0.3, 0.7, fbm(tPos[k * 3] / 45, tPos[k * 3 + 2] / 45, 3))], k * 4);
  }
  for (const s of stamps) {            // grazed pasture and stubble: shorter grass, or none
    const i0 = Math.round((s.x + TS / 2) / TC), j0 = Math.round((s.z + TS / 2) / TC), n = Math.ceil(s.r / TC);
    for (let j = j0 - n; j <= j0 + n; j++) for (let i = i0 - n; i <= i0 + n; i++) {
      if (i < 0 || j < 0 || i > TG || j > TG) continue;
      const k = j * TW + i; data[k * 4 + 2] = Math.max(data[k * 4 + 2], s.amt * smooth(s.r, s.r * 0.55, Math.hypot(tPos[k * 3] - s.x, tPos[k * 3 + 2] - s.z)));
    }
  }
  const field = new THREE.DataTexture(data, TW, TW, THREE.RGBAFormat, THREE.FloatType); field.needsUpdate = true;
  const S = 260, COUNT = 260000, inst = new Float32Array(COUNT * 4), tall = new Float32Array(COUNT), tint = new Float32Array(COUNT * 3), col = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    inst.set([rnd() * S, rnd() * S, rnd() * 6.283, 0.6 + rnd() * 0.6], i * 4);
    tall[i] = 0.3 + rnd() * 0.6;
    col.setHSL(0.17 + rnd() * 0.09, 0.25 + rnd() * 0.25, 0.45 + rnd() * 0.25); tint.set([col.r, col.g, col.b], i * 3);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = tuftGeo.index;
  for (const a of ['position', 'normal', 'uv']) geo.setAttribute(a, tuftGeo.attributes[a]);
  geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
  geo.setAttribute('aTall', new THREE.InstancedBufferAttribute(tall, 1));
  geo.setAttribute('color', new THREE.InstancedBufferAttribute(tint, 3));
  geo.instanceCount = COUNT;
  const mat = new THREE.MeshStandardMaterial({ map: grassMat.map, alphaTest: 0.45, roughness: 1, vertexColors: true });
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uTime, uField: { value: field }, uMeadowC: uMeadow });
    s.vertexShader = 'uniform float uTime; uniform vec2 uMeadowC; uniform sampler2D uField; attribute vec4 aInst; attribute float aTall;\n' + s.vertexShader
      .replace('#include <color_vertex>', `
      vec2 wxz = mod(aInst.xy - uMeadowC, ${S.toFixed(1)}) - ${(S / 2).toFixed(1)} + uMeadowC;   // wrap around a point ahead of the rider
      vec2 gf = (wxz + ${(TS / 2).toFixed(1)}) / ${TC.toFixed(1)};
      ivec2 gi = clamp(ivec2(floor(gf)), ivec2(0), ivec2(${TG - 1}));
      vec2 gu = clamp(gf - vec2(gi), 0., 1.);
      vec4 fa = texelFetch(uField, gi, 0), fb = texelFetch(uField, gi + ivec2(0, 1), 0), fc = texelFetch(uField, gi + ivec2(1, 1), 0), fd = texelFetch(uField, gi + ivec2(1, 0), 0);
      vec4 fl = gu.x + gu.y <= 1. ? fa + (fd - fa) * gu.x + (fb - fa) * gu.y : fc + (fb - fc) * (1. - gu.x) + (fd - fc) * (1. - gu.y);
      #include <color_vertex>
      ${winter ? `float snow = smoothstep(0.25, 0.6, fl.w);
      vColor.rgb *= mix(vec3(${(1.3 * lr).toFixed(3)}, ${(0.98 * lg).toFixed(3)}, ${(0.75 * lb).toFixed(3)}), vec3(${LOOK.snowy ? '1.5, 1.6, 2.2' : '2.6, 1.7, 2.2'}), snow);          // dull winter grass; dead straw where it stands out of the snow`
      : `vColor.rgb *= mix(vec3(0.8, 0.95, 0.7), vec3(1.3, 1.15, 0.75), fl.w) * vec3(${(1.15 * lr).toFixed(3)}, ${(1.15 * lg).toFixed(3)}, ${(1.15 * lb).toFixed(3)});                 // same green-to-dry tint as the ground beneath, in the season's colour`}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      objectNormal = normalize(vec3(fa.x - fd.x, ${TC.toFixed(1)}, fa.x - fb.x));                  // take the hillside's light, not a flat field's`)
      .replace('#include <begin_vertex>', `
      vec2 dc = abs(wxz - uMeadowC);
      float keep = (1. - smoothstep(${(S * 0.36).toFixed(1)}, ${(S * 0.48).toFixed(1)}, max(dc.x, dc.y)))
                 * smoothstep(12.5, 16.5, fl.y) * (1. - smoothstep(0.15, 0.5, fl.z));        // thin out far away, off the road, off the rock
      ${winter ? 'keep *= mix(1., step(0.98, fract(aInst.z * 61.7)), snow);                      // under snow only a tuft here and there pokes through' : ''}
      float cs = cos(aInst.z), sn = sin(aInst.z);
      vec3 loc = vec3(position.x * aInst.w, position.y * aTall, position.z * aInst.w);
      loc.xz = vec2(cs * loc.x - sn * loc.z, sn * loc.x + cs * loc.z);
      float wv = sin(uTime * 1.7 + wxz.x * 0.35 + wxz.y * 0.27) * 0.16 + sin(uTime * 3.3 + wxz.x * 1.3) * 0.05;
      loc.x += wv * uv.y; loc.z += wv * 0.6 * uv.y;
      vec3 transformed = vec3(wxz.x, fl.x - 0.03, wxz.y) + loc * keep;`);
  };
  const meadow = new THREE.Mesh(geo, mat);
  meadow.frustumCulled = false; meadow.receiveShadow = true; meadow.visible = !XMAS; scene.add(meadow);
}
