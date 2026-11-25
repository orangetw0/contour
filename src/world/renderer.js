import * as THREE from 'three';
import { $ } from '../util/dom.js';

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.33;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
$('c').addEventListener('webglcontextlost', e => {
  e.preventDefault(); console.warn('ride: graphics context lost');
  const b = document.createElement('div'); b.id = 'lost'; b.textContent = 'Graphics were reset by the browser. Reloading…';
  b.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(10,9,8,.8);letter-spacing:.1em;font-size:13px';
  document.body.append(b);
  setTimeout(() => location.reload(), 1500);
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.05, 9000);
scene.add(camera);

export { MAX_ANISO, renderer, scene, camera };
