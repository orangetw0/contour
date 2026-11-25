/* Cycling kit, painted onto the body by a shader: jersey designs with collar, zip, cuffs and rear pockets; bib
   shorts with leg grippers and a side panel; socks; short-finger gloves. Original designs, no team or brand marks.
   Everything is drawn from where a point sits on the body at rest, so hems stay crisp at any distance. */
import * as THREE from 'three';

const V3 = THREE.Vector3;
// design: 0 chest band, 1 fade, 2 hoops, 3 sash, 4 side panels, 5 centre stripe
export const KITS = Object.freeze({
  red: { name: 'Crimson band', jersey: 0xc8202a, trim: 0xf2f2f2, accent: 0x15151a, design: 0, bike: 0xc2202c },
  blue: { name: 'Ocean fade', jersey: 0x1f5fd0, trim: 0x0d1f4a, accent: 0xf4d23c, design: 1, bike: 0x1c4fb0 },
  green: { name: 'Forest hoops', jersey: 0x1f9a55, trim: 0xf0f0ec, accent: 0x0d3a22, design: 2, bike: 0x15803f },
  orange: { name: 'Sunset sash', jersey: 0xf07a1a, trim: 0x1b1b20, accent: 0xfff1d6, design: 3, bike: 0xe0660f },
  white: { name: 'Glacier panels', jersey: 0xeef0f2, trim: 0x2a6fe0, accent: 0x12203a, design: 4, bike: 0xdadde2 },
  black: { name: 'Onyx stripe', jersey: 0x1a1a1e, trim: 0xe83a5e, accent: 0xf4f4f4, design: 5, bike: 0x222226 },
  purple: { name: 'Violet fade', jersey: 0x7a3fd0, trim: 0x25104a, accent: 0xf2e7ff, design: 1, bike: 0x5b2fa8 },
  yellow: { name: 'Citrus panels', jersey: 0xf2cc1f, trim: 0x17171b, accent: 0xffffff, design: 4, bike: 0xd9b411 },
});

const ARM = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/, HAND = /^(hand|index|middle|ring|pinky|thumb)/;
const LEG = /^(thigh|calf|foot|ball)/, HEAD = /^(neck|Head)/;
export const FOOT = /^(foot|ball)/;

// How far along its limb a point is: 0 at the shoulder or hip, 1 at the wrist or ankle. Hems are drawn from this.
export function limbCoord(joint) {
  const along = (a, b) => { const d = new V3().subVectors(b, a), l2 = d.lengthSq(); return q => (q.dot(d) - a.dot(d)) / l2; };
  const armT = { 1: along(joint.upperarm_l, joint.hand_l), [-1]: along(joint.upperarm_r, joint.hand_r) }, legT = { 1: along(joint.thigh_l, joint.foot_l), [-1]: along(joint.thigh_r, joint.foot_r) };
  return (p, arm, leg) => (leg > arm ? legT : armT)[p.x >= 0 ? 1 : -1](p);
}

/* Give the body its kit. Each vertex learns how much it belongs to an arm, a leg, a hand or foot, or the head (from
   the skeleton's weights) and how far along its limb it is; the shader draws the clothes from those.
   joint: rest positions of the bones. kit: one of KITS. skin: colour lift, [r, g, b]. thigh: thigh girth scale. */
export function dress(body, joint, kit, skin, thigh = 1) {
  const geo = body.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, names = body.skeleton.bones.map(b => b.name);
  if (!geo.attributes.aPart) {                         // worked out once per character; every rider of that character shares it
    const part = new Float32Array(pos.count * 4), head = new Float32Array(pos.count), p = new V3(), coord = limbCoord(joint);
    for (let i = 0; i < pos.count; i++) {
      let arm = 0, leg = 0, end = 0, hd = 0;
      for (let k = 0; k < 4; k++) {
        const n = names[si.getComponent(i, k)], w = sw.getComponent(i, k);
        if (ARM.test(n)) arm += w; if (LEG.test(n)) leg += w; if (HAND.test(n) || FOOT.test(n)) end += w; if (HEAD.test(n)) hd += w;
      }
      p.fromBufferAttribute(pos, i);
      part.set([arm, leg, end, coord(p, arm, leg)], i * 4); head[i] = hd;
    }
    geo.setAttribute('aPart', new THREE.BufferAttribute(part, 4));
    geo.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
  }
  const mat = body.material.clone(), c = h => ({ value: new THREE.Color(h) });
  const u = {
    uJersey: c(kit.jersey), uTrim: c(kit.trim), uAccent: c(kit.accent ?? kit.trim), uBib: c(0x0f0f12), uSock: c(0xf3f3f1), uGlove: c(0x131316), uSkin: { value: new V3(...skin) },
    // heights: collar, waist, (unused), top of the shoe
    uLines: { value: new THREE.Vector4(joint.neck_01.y + 0.03, joint.pelvis.y + 0.075, 0, joint.foot_l.y - 0.03) },
    // where front meets back, half the chest's width, where the knuckles are, which design
    uBody: { value: new THREE.Vector4(joint.spine_02.z - 0.01, joint.upperarm_l.x - 0.035, Math.abs(joint.middle_01_l.x) + 0.012, kit.design ?? 0) },
    uThigh: { value: joint.thigh_l.x + 0.058 * thigh },
  };
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'attribute vec4 aPart; attribute float aHead; varying vec4 vPart; varying float vHead; varying vec3 vRest;\n' + s.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vPart = aPart; vHead = aHead; vRest = position;');
    s.fragmentShader = `uniform vec3 uJersey, uTrim, uAccent, uBib, uSock, uGlove, uSkin; uniform vec4 uLines, uBody; uniform float uThigh;
      varying vec4 vPart; varying float vHead; varying vec3 vRest; float kitCloth;
      float band(float x, float at, float half_) { return 1. - smoothstep(half_ * 0.85, half_, abs(x - at)); }
      ` + s.fragmentShader
      // cloth lies smooth over the body, and bare skin shows less sinew than the model's texture has
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize(mix(normal, nonPerturbedNormal, mix(0.45, 0.85, kitCloth)));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(max(roughnessFactor, 0.55), 0.8, kitCloth);')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 skin = min(diffuseColor.rgb * uSkin, vec3(0.92)), c;
        float arm = vPart.x, leg = vPart.y, end = vPart.z, t = vPart.w, ax = abs(vRest.x);
        float ty = clamp((vRest.y - uLines.y) / (uLines.x - uLines.y), 0., 1.);                 // up the jersey: 0 at the hem, 1 at the collar
        float front = step(uBody.x, vRest.z), offArm = smoothstep(0.42, 0.12, arm);
        int design = int(uBody.w + 0.5);
        vec3 j = uJersey, sleeve = uJersey;
        if (design == 0) j = mix(j, uTrim, band(ty, 0.6, 0.085) * offArm);                       // a band across the chest
        else if (design == 1) { j = mix(uTrim, uJersey, smoothstep(0.05, 0.75, ty)); }          // dark at the hem, fading up
        else if (design == 2) j = mix(j, uTrim, step(0.55, fract(ty * 5.0 + 0.1)) * step(0.3, ty) * step(ty, 0.8) * offArm);     // hoops
        else if (design == 3) j = mix(j, uTrim, band(ty + vRest.x * 1.7 * (front * 2. - 1.), 0.52, 0.1) * offArm);                // a sash from shoulder to hip
        else if (design == 4) { j = mix(j, uTrim, smoothstep(uBody.y * 0.56, uBody.y * 0.6, ax)); sleeve = uTrim; }              // side panels and sleeves
        else { j = mix(j, uTrim, 1. - smoothstep(0.03, 0.034, ax)); j = mix(j, uAccent, band(ax, 0.047, 0.004)); }               // a centre stripe with pinstripes
        j = mix(j, uAccent, step(0.92, ty));                                                     // collar
        j *= 1. - 0.5 * front * (1. - smoothstep(0.002, 0.0045, ax)) * step(ty, 0.92);           // zip
        j *= 1. - 0.28 * (1. - front) * max(band(ty, 0.27, 0.006), step(ty, 0.27) * band(ax, 0.06, 0.004));   // three rear pockets
        j = mix(j, uAccent, step(ty, 0.03));                                                     // hem gripper
        if (vHead > 0.5) c = skin;
        else if (arm > 0.5) {
          if (end > 0.5) c = ax < uBody.z ? mix(uGlove, uAccent, band(ax, uBody.z - 0.012, 0.006)) : skin;      // short-finger gloves
          else c = t < 0.41 ? (t > 0.35 ? uAccent : sleeve) : skin;                                // short sleeves with a cuff
        }
        else if (leg > 0.5 && end > 0.45 && vRest.y < uLines.w) discard;                           // the foot is inside the shoe
        else if (leg > 0.5) {
          if (end > 0.45 || t > 0.74) c = t < 0.765 && end < 0.45 ? uAccent : uSock;               // socks, with a coloured cuff
          else if (t < 0.44) c = t > 0.395 ? mix(uBib * 2.2, uTrim, band(t, 0.433, 0.006)) : mix(uBib, uJersey, step(uThigh, ax) * step(0.06, t));   // bibs: side panel, leg gripper
          else c = skin;
        }
        else c = vRest.y > uLines.x ? skin : (vRest.y < uLines.y ? uBib : j);
        kitCloth = c == skin ? 0. : 1.;
        diffuseColor.rgb = c;
      }`);
  };
  mat.customProgramCacheKey = () => 'contour-kit-2';
  body.material = mat;
  return u;
}
