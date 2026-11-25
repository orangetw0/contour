import * as THREE from 'three';
import { MAX_ANISO } from './renderer.js';

/* ---------- photo-scanned surfaces (Poly Haven, CC0) ---------- */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing texture')); i.src = src; });
const TEX = ['asphalt_02_diff_2k', 'asphalt_02_nor_gl_2k', 'leafy_grass_diff_2k', 'leafy_grass_nor_gl_1k', 'rock_face_03_diff_1k', 'gravel_ground_01_diff_1k'];
let imgs = await Promise.all(TEX.map(n => loadImg(`assets/${n}.jpg`))).catch(() => null);
if (!imgs) throw new Error('missing textures');
const [imgAsphalt, imgAsphaltN, imgGrass, imgGrassN, imgRock, imgGravel] = imgs;
const imgTex = (img, srgb) => {
  const t = new THREE.Texture(img); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO; t.needsUpdate = true; return t;
};

export { imgTex, imgRock, imgGrass, imgGrassN, imgAsphalt, imgAsphaltN, imgGravel };
