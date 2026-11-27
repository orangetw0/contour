import { canvas2d } from '../util/dom.js';
import { rnd } from '../util/noise.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V3 } from './shared.js';
import { P, R, T, XMAS, N, real } from '../course/index.js';
import { LOOK } from './look.js';
import { uTime } from './sky.js';
import { meshH } from './terrain.js';
import { scene } from './renderer.js';
import './road.js';

/* ---------- grass along the verge (chunks, only the near ones are drawn) ---------- */
function grassTex() {
  const [c, g] = canvas2d(256, 256);
  for (let i = 0; i < 36; i++) {
    const x = 20 + rnd() * 216, h = 110 + rnd() * 140, lean = (rnd() - 0.5) * 90, w = 5 + rnd() * 5;
    const gr = g.createLinearGradient(0, 256, 0, 256 - h);
    gr.addColorStop(0, '#23360f'); gr.addColorStop(0.6, '#5b7824'); gr.addColorStop(1, rnd() < 0.45 ? '#cdb968' : '#90a43c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, 256);
    g.quadraticCurveTo(x + lean * 0.3, 256 - h * 0.6, x + lean, 256 - h);
    g.quadraticCurveTo(x + lean * 0.3 + w * 0.4, 256 - h * 0.6, x + w / 2, 256); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const tuftGeo = (() => {
  const parts = [0, 1, 2, 3].map(k => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(k * Math.PI / 2));
  const g = mergeGeometries(parts), n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);    // light it like the ground it grows from
  return g;
})();
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex(), alphaTest: 0.45, roughness: 1 });
if (real) grassMat.color.setRGB(...LOOK.grass);
grassMat.onBeforeCompile = s => {
  s.uniforms.uTime = uTime;
  s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      vec4 wp = instanceMatrix * vec4(0., 0., 0., 1.);
      float w = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.27) * 0.16 + sin(uTime * 3.3 + wp.x * 1.3) * 0.05;
      transformed.x += w * uv.y; transformed.z += w * 0.6 * uv.y;
    #endif`);
};
const chunks = [];
{
  const PER = 40, COUNT = 7000, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), sc = new V3(), ps = new V3(), col = new THREE.Color();
  const build = c0 => {
    const mesh = new THREE.InstancedMesh(tuftGeo, grassMat, COUNT);
    for (let k = 0; k < COUNT; k++) {
      const i = c0 + Math.floor(rnd() * PER), side = rnd() < 0.5 ? -1 : 1, d = 3.55 + Math.pow(rnd(), 1.6) * 12.5, j = (rnd() - 0.5) * 1.5;
      const x = P[i].x + R[i].x * side * d + T[i].x * j, z = P[i].z + R[i].z * side * d + T[i].z * j;
      let y = meshH(x, z);
      if (d < 6.8) y = Math.max(y, P[i].y + T[i].y * j - 0.72 * (d - 3.5) / 3.3);
      const tall = 0.28 + rnd() * 0.5 + (d > 5 ? rnd() * 0.25 : 0);
      ps.set(x, y - 0.03, z); q.setFromAxisAngle(up, rnd() * 6.283); sc.set(0.5 + rnd() * 0.5, tall, 0.5 + rnd() * 0.5);
      mesh.setMatrixAt(k, m4.compose(ps, q, sc));
      mesh.setColorAt(k, col.setHSL(0.19 + rnd() * 0.07, 0.25 + rnd() * 0.25, 0.5 + rnd() * 0.25));
    }
    mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh);
    return mesh;
  };
  if (!XMAS) for (let c0 = 0; c0 + PER <= N; c0 += PER) chunks.push({ c: P[c0 + PER / 2], mesh: null, build: () => build(c0) });
}

export { tuftGeo, grassMat, chunks };
