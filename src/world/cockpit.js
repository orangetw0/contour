import * as THREE from 'three';
import { canvas2d } from '../util/dom.js';
import { V3 } from './shared.js';
import { camera } from './renderer.js';
import './weather.js';

/* ---------- cockpit ---------- */
const rig = new THREE.Group();
rig.position.set(0, -0.33, -0.5);
camera.add(rig);
const [huC, huG] = canvas2d(128, 224);
const huTex = new THREE.CanvasTexture(huC); huTex.colorSpace = THREE.SRGBColorSpace;
{
  const half = [[.205, -.135, .05], [.21, -.13, -.05], [.21, -.07, -.105], [.205, -.005, -.085], [.19, 0, -.02], [.14, 0, 0], [0, 0, 0]];
  const pts = [...half, ...half.slice(0, -1).reverse().map(p => [-p[0], p[1], p[2]])].map(p => new V3(...p));
  const tape = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.82 });
  const gloss = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.35, metalness: 0.3 });
  rig.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.0135, 12), tape));
  for (const sx of [-1, 1]) {
    const hood = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.075, 6, 14), gloss);
    hood.position.set(sx * 0.207, 0.022, -0.115); hood.rotation.x = -1.0; rig.add(hood);
  }
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.03, 0.12), gloss); stem.position.set(0, -0.004, 0.06); rig.add(stem);
  const unit = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.012, 0.092), gloss); unit.position.set(0, 0.03, -0.075); unit.rotation.x = 0.4; rig.add(unit);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.047, 0.083).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: huTex }));
  screen.position.y = 0.0065; unit.add(screen);
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.014, 10, 72), tape); tyre.rotation.y = Math.PI / 2; tyre.position.set(0, -0.66, -0.12); rig.add(tyre);
  rig.traverse(o => { if (o.isMesh && o !== screen) o.receiveShadow = true; });
}
function drawHeadUnit(speed, speedLabel, w) {
  huG.fillStyle = '#d9dccf'; huG.fillRect(0, 0, 128, 224);
  huG.fillStyle = '#16181a'; huG.textAlign = 'center';
  huG.font = '600 58px Helvetica, Arial, sans-serif'; huG.fillText(speed.toFixed(0), 64, 82);
  huG.font = '600 13px Helvetica, Arial, sans-serif'; huG.fillText(speedLabel.toUpperCase(), 64, 104);
  huG.fillRect(14, 122, 100, 2);
  huG.font = '600 40px Helvetica, Arial, sans-serif'; huG.fillText(w.toFixed(0), 64, 176);
  huG.font = '600 13px Helvetica, Arial, sans-serif'; huG.fillText('WATTS', 64, 198);
  huTex.needsUpdate = true;
}

export { rig, drawHeadUnit };
