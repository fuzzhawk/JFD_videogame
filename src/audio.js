// Tiny WebAudio synth. No asset files needed — every sound is generated with
// oscillators/noise so the game stays self-contained and light for mobile.

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

// Mobile browsers require audio to start from a user gesture.
export function resumeAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type = 'square', vol = 0.4, slide = 0) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol = 0.3, hp = 800) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

// Named sound effects.
export const sfx = {
  coin() {
    tone(880, 0.07, 'square', 0.35);
    setTimeout(() => tone(1320, 0.09, 'square', 0.3), 60);
  },
  pickup() {
    tone(660, 0.06, 'triangle', 0.4, 200);
  },
  hotdog() {
    tone(520, 0.08, 'sawtooth', 0.3, 120);
  },
  sell() {
    tone(440, 0.05, 'square', 0.35);
    setTimeout(() => tone(660, 0.05, 'square', 0.35), 55);
    setTimeout(() => tone(880, 0.12, 'square', 0.35), 110);
  },
  buff() {
    tone(523, 0.08, 'triangle', 0.35);
    setTimeout(() => tone(784, 0.08, 'triangle', 0.35), 70);
    setTimeout(() => tone(1046, 0.14, 'triangle', 0.35), 140);
  },
  rapHit(step = 0) {
    // A pentatonic riff so consecutive hits sound musical.
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    tone(scale[step % scale.length], 0.12, 'sawtooth', 0.3);
  },
  rapMiss() {
    tone(140, 0.16, 'sawtooth', 0.3, -40);
  },
  perfect() {
    tone(660, 0.06, 'square', 0.3);
    setTimeout(() => tone(990, 0.06, 'square', 0.3), 50);
    setTimeout(() => tone(1320, 0.12, 'square', 0.3), 100);
  },
  step() {
    noiseBurst(0.04, 0.06, 1200);
  },
  ui() {
    tone(700, 0.04, 'square', 0.25);
  },
  bad() {
    tone(180, 0.2, 'sawtooth', 0.3, -60);
  },
};
