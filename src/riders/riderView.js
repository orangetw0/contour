/* Puts a rider and bike into the world: one rig that follows a rider's place on the road. */
import * as THREE from 'three';
import { createBike, makeGeo, BIKE_STYLES } from './bike.js';
import { loadCharacter, createAvatar, KITS } from './avatar.js';
import { LOOK } from '../world/look.js';

const V3 = THREE.Vector3, m = new THREE.Matrix4(), left = new V3(), up = new V3(), fwd = new V3(), q = new THREE.Quaternion(), AXIS_Z = new V3(0, 0, 1), AXIS_Y = new V3(0, 1, 0);

function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 80;
  const g = c.getContext('2d'); g.font = '600 40px -apple-system, Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(372, g.measureText(text).width + 36);
  g.fillStyle = 'rgba(12,10,8,0.55)'; g.beginPath(); g.roundRect((384 - w) / 2, 10, w, 60, 30); g.fill();
  g.fillStyle = '#fff'; g.fillText(text, 192, 42, 340);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(1.5, 0.3125, 1); s.position.set(0, 2.2, 0); s.renderOrder = 5;
  return s;
}

// label: a name to float above the rider (other riders have one; you don't)
export function createRiderView(scene, { label = '' } = {}) {
  const rig = new THREE.Group(), pos = new V3(); rig.matrixAutoUpdate = false; rig.visible = false; scene.add(rig);
  let bike = null, avatar = null, tag = null, want = '', crank = 0, lastDist = null, yaw = 0;

  // (re)build for a character and kit; the model loads in the background
  // who: { character, kit, kg, heightM, skin, bike }
  async function dress(who) {
    const { character = 'male', kit = 'red', kg = 72, heightM = 1.78, skin = 'medium', bike: bikeKey = 'allround' } = who;
    const key = [character, kit, Math.round(kg), heightM.toFixed(2), skin, bikeKey].join('/'); if (key === want) return; want = key;
    const colours = KITS[kit] || KITS.red, gltf = await loadCharacter(character);
    if (want !== key) return;                                      // changed again while loading
    rig.clear();
    const geo = makeGeo(heightM / 1.8);                             // a frame to fit
    bike = createBike({ frame: colours.bike, geo, style: BIKE_STYLES[bikeKey] || 'climbing' }); avatar = createAvatar(gltf, { kit: colours, sex: character, kg, heightM, skin, geo, wear: LOOK.wear });      // dressed for the season
    tag = null;
    rig.add(bike.object, avatar.object);
    if (label) { tag = nameTag(label); tag.position.y = heightM + 0.42; rig.add(tag); }
  }

  /* Place the rig. pose: the road at the rider (p, t, r from the course line). rider: the simulation's rider.
     lean: radians into the bend. dt: seconds since the last frame. */
  function update(rider, pose, lean, dt) {
    if (!avatar) return;
    const cadence = rider.cadence != null ? rider.cadence : rider.power > 5 && rider.v > 0.3 ? 62 + Math.min(38, rider.power / 8) : 0;
    crank += dt * cadence / 60 * Math.PI * 2;
    const rolled = lastDist === null ? 0 : rider.dist - lastDist; lastDist = rider.dist;
    // the picture: turning the bars a touch when changing line, rocking the shoulders with effort
    const drift = Math.atan2(rider.slide, Math.max(rider.v, 2));
    bike.update(rolled, crank, -drift * 0.8);
    rig.matrix.identity(); rig.updateMatrixWorld(true);              // the pose is solved in the bike's own frame
    avatar.pose(crank, Math.sin(crank) * Math.min(0.05, rider.power / 9000));
    // where and which way: along the road in the rider's direction, offset into their lane
    fwd.copy(pose.t).multiplyScalar(rider.dir); left.copy(pose.r).multiplyScalar(-rider.dir); up.crossVectors(fwd, left).normalize(); left.crossVectors(up, fwd);
    pos.copy(pose.p).addScaledVector(left, -rider.lane);
    m.makeBasis(left, up, fwd); q.setFromRotationMatrix(m);
    const ease = rider.uturn * rider.uturn * (3 - 2 * rider.uturn);         // coming round after a U-turn
    yaw = -drift + ease * Math.PI;
    q.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, yaw)).multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, lean));
    rig.matrix.compose(pos, q, rig.scale); rig.updateMatrixWorld(true);
  }
  // name tags are for riders a little way off: hidden right next to the camera and far away
  const showTag = distance => { if (tag) tag.visible = distance > 5 && distance < 70; };
  return { rig, dress, update, showTag, pos, get ready() { return !!avatar; } };
}
