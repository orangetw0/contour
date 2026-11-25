/* What the bots say. Lines are picked to fit what the speaker is doing (climbing, descending, on a wheel), and
   another bot sometimes answers. No network and no language model: just a small script with some chance in it. */
const SAY = {
  hello: ['Morning all', 'Hi everyone', 'Afternoon! Legs feel good today', 'Hello from the back of the group', 'Anyone doing the full loop?'],
  climb: ['Here we go, the climb', 'Why is it always steeper than I remember', 'Steady on the hill please', 'Spinning my lowest gear already', 'See you at the top'],
  descent: ['Wheee', 'Finally some downhill', 'Brakes are for bends', 'Time to recover'],
  draft: ['Thanks for the tow, {other}', 'Nice wheel, {other}', 'Sitting in for a bit, {other}', 'I owe you a turn on the front, {other}'],
  flat: ['Good pace today', 'Anyone want to work together?', 'Lovely light this evening', 'Legs are coming round', 'How far are you going today?', 'Coffee after this?'],
  pacer: ['Holding {wkg} w/kg, hop on', 'Steady {wkg} w/kg all the way round'],
};
const REPLY = {
  hello: ['Morning!', 'Hi {other}', 'Hey hey', 'Hello!'], climb: ['Same here', 'Pace yourself', 'It flattens near the top. A bit.', 'Ha, every time'],
  descent: ['Careful on the bends', 'Earned it'], draft: ['Any time', 'No worries', 'Your turn next lap'], flat: ['Yes!', 'Count me in', 'One more lap for me', 'Always', 'Sounds good'], pacer: ['On my way', 'Thanks pacer'],
};

/* Makes a chat source. each call to step(dt, speakers) may return messages: { name, text }.
   speakers: bots near the player, each { name, grade, drag, draftFrom (name or null), pacer, wkg }. */
export function createChatter({ rand = Math.random, quiet = [18, 45] } = {}) {
  const pick = a => a[Math.floor(rand() * a.length)], gap = () => quiet[0] + rand() * (quiet[1] - quiet[0]);
  let wait = 6 + rand() * 6, said = 0;
  const pending = [];
  return {
    step(dt, speakers) {
      const out = [];
      for (let i = pending.length - 1; i >= 0; i--) if ((pending[i].in -= dt) <= 0) { out.push(pending[i].msg); pending.splice(i, 1); }
      if ((wait -= dt) > 0 || !speakers.length) return out;
      wait = gap();
      const who = pick(speakers);
      const topic = said++ === 0 ? 'hello' : who.pacer ? 'pacer' : who.draftFrom && who.drag < 0.85 && rand() < 0.6 ? 'draft' : who.grade > 4 ? 'climb' : who.grade < -4 ? 'descent' : 'flat';
      const fill = (t, other) => t.replace('{other}', other ? other.split(' ')[0] : 'all').replace('{wkg}', (who.wkg || 0).toFixed(1));
      out.push({ name: who.name, text: fill(pick(SAY[topic]), who.draftFrom) });
      const others = speakers.filter(s => s !== who && !s.pacer);
      if (others.length && rand() < 0.55) {                       // someone answers a few seconds later
        const ans = topic === 'draft' ? others.find(s => s.name === who.draftFrom) || pick(others) : pick(others);
        pending.push({ in: 2.5 + rand() * 4, msg: { name: ans.name, text: fill(pick(REPLY[topic]), who.name) } });
      }
      return out;
    },
  };
}
