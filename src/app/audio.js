/* Sound: wind, tyres and rain from filtered noise. Starts on the first key or click, as browsers require. */
let audio = null;

function start() {
  if (audio) return;
  const ac = new AudioContext(), buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const mk = (type, freq, q) => {
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(ac.destination); src.start();
    return { f, g };
  };
  audio = { ac, wind: mk('bandpass', 500, 0.5), tyre: mk('lowpass', 240, 0.8), rain: mk('highpass', 2600, 0.5) };
}

export function initAudio() {
  addEventListener('pointerdown', start); addEventListener('keydown', start);
}

// v: rider speed in m/s; rain: 0 to 1
export function updateAudio(v, rain) {
  if (!audio) return;
  const t = audio.ac.currentTime;
  audio.wind.g.gain.setTargetAtTime(Math.min(0.5, v * v / 400 * 0.35), t, 0.2);
  audio.wind.f.frequency.setTargetAtTime(300 + v * 40, t, 0.2);
  audio.tyre.g.gain.setTargetAtTime(Math.min(0.35, v / 15 * 0.25), t, 0.2);
  audio.rain.g.gain.setTargetAtTime(rain * 0.1, t, 0.4);
}
