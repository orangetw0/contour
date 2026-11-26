import { real } from '../course/index.js';
import * as THREE from 'three';
import { scene } from './renderer.js';

/* ---------- a lake or the sea: one level sheet of water; the ground under it has been sunk, so it shows only where the survey found water ---------- */
if (real && real.water != null) {
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(real.size, real.size).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c5f7c, roughness: 0.12, metalness: 0.35 }));
  sheet.position.y = real.water - 0.6; sheet.receiveShadow = true; scene.add(sheet);
}
