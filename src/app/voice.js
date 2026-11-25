/* Voice: change the weather, the hills, or skip, by speaking (Chrome or Edge). */
import { $ } from '../util/dom.js';

export function initVoice({ trainer, setWeather, skip, setClean, xmas, lab }) {
  const { setHills, hills, label: hillsLabel } = trainer;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, btn = $('voice');
  const WORDS = [                      // the first match in what was heard wins
    [/\b(easier|easy|lighter|less|ease|gear down|shift down|change down|lower gear|down a gear)\b/, hillsLabel, () => setHills(hills() * 100 - 20)],
    [/\b(harder|hard|heavier|more|tougher|gear up|shift up|change up|higher gear|up a gear)\b/, hillsLabel, () => setHills(hills() * 100 + 20)],
    [/\b(flat|no hills|hills off)\b/, hillsLabel, () => setHills(0)],
    [/\b(full|real hills|all of it)\b/, hillsLabel, () => setHills(100)],
    ...(xmas ? [[/\b(snow|snowing|snowy|christmas)\b/, 'Snow', () => setWeather('snow')]] : []),
    [/\b(rain|raining|rainy|storm|wet)\b/, 'Rain', () => setWeather('rain')],
    [/\b(mist|misty|fog|foggy)\b/, 'Mist', () => setWeather('mist')],
    [/\b(overcast|cloud|clouds|cloudy|grey|gray)\b/, 'Overcast', () => setWeather('overcast')],
    [/\b(golden|sun|sunny|sunshine|sunset|clear|evening)\b/, 'Golden', () => setWeather('golden')],
    ...(lab ? [[/\b(starry|stars|night|painting|van gogh)\b/, 'Starry', () => setWeather('starry')]] : []),
    [/\b(skip|forward|ahead)\b/, 'Skip ahead', () => skip(250)],
    [/\bback\b/, 'Skip back', () => skip(-250)],
    [/\b(hide|hidden)\b/, 'Info hidden', () => setClean(true)],
    [/\b(show|info|display)\b/, 'Info shown', () => setClean(false)]];
  let rec = null, on = false, last = 0;
  const label = t => { btn.textContent = t; btn.classList.toggle('on', on); };
  if (!SR) { btn.title = 'Voice control needs Chrome or Edge'; btn.addEventListener('click', () => label('Voice: needs Chrome')); }
  else btn.addEventListener('click', () => {
    if (on) { on = false; rec.stop(); label('Voice: off'); return; }
    rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-GB';
    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const heard = e.results[i][0].transcript.toLowerCase(), hit = WORDS.find(w => w[0].test(heard));
        if (hit && performance.now() - last > 2500) { last = performance.now(); hit[2](); label('Voice: ' + (typeof hit[1] === 'function' ? hit[1]() : hit[1])); }
      }
    };
    rec.onend = () => { if (on) { try { rec.start(); } catch (err) {} } };          // the browser stops listening after a silence, so start again
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { on = false; label('Voice: blocked'); } };
    on = true; rec.start(); label('Voice: listening');
  });
}
