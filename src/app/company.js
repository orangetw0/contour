/* Company on the road: the bots' pictures, their chat, the draft read-out and the Pacers panel. */
import { $, panelButton } from '../util/dom.js';
import { createRiderView } from '../riders/riderView.js';
import { createChatter } from '../sim/chatter.js';
import { gapAhead } from '../sim/draft.js';
import { mkPose } from '../course/line.js';

const SEE = 140;       // metres: riders further away than this are not drawn

export function initCompany({ scene, camera, line, bots, rider, unit, onJoin }) {
  const views = bots.map(b => { const v = createRiderView(scene, { label: b.name }); v.dress(b); return v; });
  const poses = bots.map(() => ({ here: mkPose(), next: mkPose(), lean: 0 }));
  const around = (a, b) => { const g = gapAhead({ s: a.s, dir: 1 }, b, line.LEN); return Math.min(g, line.LEN - g); };

  // chat: a few lines at the bottom right, fading after a while
  const feed = $('chat'), chatter = createChatter();
  const say = m => {
    const d = document.createElement('div'), b = document.createElement('b'); b.textContent = m.name; d.append(b, m.text); feed.append(d);
    while (feed.children.length > 5) feed.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 11000); setTimeout(() => d.remove(), 12500);
  };
  let chatT = 0;

  // pacers panel: who they are, how far away, and a button to drop in behind one
  const pacers = bots.filter(b => b.bot.pacer), box = $('pacers');
  const facts = (p, u) => `${p.bot.wkg.toFixed(1)} w/kg · ${u.speed(p.v).toFixed(0)} ${u.speedLabel} · ${u.distance(around(rider, p)).toFixed(1)} ${u.distanceLabel} away`;
  const refresh = () => { const u = unit(); box.querySelectorAll('.facts').forEach((el, i) => { el.textContent = facts(pacers[i], u); }); };
  const draw = () => {
    box.innerHTML = '<h3>Pacers</h3>' + pacers.map((p, i) => `<div class="row"><span>${p.name} <span class="muted facts"></span></span><button data-i="${i}">Join</button></div>`).join('') +
      '<div class="note">Pacers hold a steady effort and lap the course without stopping. Sit on their wheel for the draft.</div>';
    box.querySelectorAll('button').forEach(b => { b.onclick = () => { onJoin(pacers[+b.dataset.i]); refresh(); }; });
    refresh();
  };
  if (pacers.length) panelButton($('pacerbtn'), box, draw); else $('pacerbtn').remove();
  setInterval(() => { if (!box.hidden) refresh(); }, 2000);            // only the numbers change, so the buttons stay put

  return {
    // once a second or so of simulated time: let the bots near the player talk
    talk(dt) {
      chatT += dt; if (chatT < 1) return;
      const near = bots.filter(b => around(rider, b) < 250).map(b => ({ name: b.name, grade: b.grade, drag: b.drag, draftFrom: b.draftFrom ? b.draftFrom.name || 'you' : null, pacer: b.bot.pacer, wkg: b.bot.wkg }));
      for (const m of chatter.step(chatT, near)) say(m);
      chatT = 0;
    },
    // every frame: draw the riders that are close enough to see
    draw(dt) {
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i], v = views[i], p = poses[i], seen = v.ready && around(rider, b) < SEE;
        v.rig.visible = seen; if (!seen) continue;
        line.at(b.s, p.here); line.at(b.s + b.dir * 4, p.next);
        const kappa = -(p.here.t.z * p.next.t.x - p.here.t.x * p.next.t.z) / 4;
        p.lean += (Math.atan(b.v * b.v * kappa / 9.81) * 0.8 - p.lean) * Math.min(1, dt * 3);
        v.update(b, p.here, p.lean, dt);
        v.showTag(v.pos.distanceTo(camera.position));
      }
    },
  };
}
