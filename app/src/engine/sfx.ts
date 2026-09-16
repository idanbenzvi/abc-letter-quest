// Synthesized sound effects + ambient bed — Web Audio only, no audio
// assets to ship or load. Every cue is a few oscillators/noise bursts
// shaped by envelopes, tuned to sit under the spoken letter audio
// (engine/audio.ts) rather than compete with it. Kept deliberately
// soft: this is a bedtime-adjacent game for a six-year-old, not an
// arcade cabinet.
//
// Browser autoplay rules: an AudioContext can only start (or resume)
// inside a user gesture, so `unlock()` must be called from a tap/click
// handler — "Take Off!" is the natural one. Every `play()` before that
// is a silent no-op, never an error.

export type SfxName =
  | 'tap' // any UI button press — a tiny woody tick
  | 'correct' // "Knew it!" — a warm two-note chime
  | 'bonus' // typed/traced/said/picked — a rising sparkle arpeggio
  | 'miss' // "Not yet" — a soft, kind low tone (never a buzzer)
  | 'whoosh' // flying through a cloud — filtered noise swell
  | 'pop' // bubble-burst cloud — a bright little pop
  | 'takeoff' // mission start — wing-beat whoosh + rising swell
  | 'land' // mission end — a settling, resolved chord
  | 'stroke' // one stroke of a traced letter finished — a single soft bell
  | 'mastered'; // a letter reaching mastery on the end screen — fanfare

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let ambient: { gain: GainNode; stop: () => void } | null = null;

const MASTER_VOLUME = 0.55;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Call from inside a user gesture (tap/click) — creates and resumes the context so later cues can play. Safe to call repeatedly. */
export function unlock(): void {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05);
  }
}

export function isMuted(): boolean {
  return muted;
}

function ready(): { c: AudioContext; out: GainNode } | null {
  const c = ctx;
  if (!c || !master || c.state !== 'running') return null;
  return { c, out: master };
}

/** A short noise buffer, reused for every noise-based cue. */
let noiseBuffer: AudioBuffer | null = null;
function getNoise(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const seconds = 2;
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

function tone(
  c: AudioContext,
  out: AudioNode,
  { freq, type = 'sine', start = 0, attack = 0.01, hold = 0.05, release = 0.25, peak = 0.3, glideTo, detune = 0 }: {
    freq: number;
    type?: OscillatorType;
    start?: number;
    attack?: number;
    hold?: number;
    release?: number;
    peak?: number;
    glideTo?: number;
    detune?: number;
  },
): void {
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + attack + hold + release);
  osc.detune.value = detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + attack + hold + release + 0.05);
}

function noise(
  c: AudioContext,
  out: AudioNode,
  { start = 0, attack = 0.05, hold = 0.1, release = 0.4, peak = 0.2, filterType = 'bandpass', freq = 800, freqTo, q = 0.8 }: {
    start?: number;
    attack?: number;
    hold?: number;
    release?: number;
    peak?: number;
    filterType?: BiquadFilterType;
    freq?: number;
    freqTo?: number;
    q?: number;
  },
): void {
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + attack + hold + release);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + attack + hold + release + 0.05);
}

// Pentatonic-ish pitches so any two cues overlapping still sound consonant.
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

export function play(name: SfxName): void {
  const r = ready();
  if (!r || muted) return;
  const { c, out } = r;
  switch (name) {
    case 'tap':
      tone(c, out, { freq: 1800, type: 'triangle', attack: 0.004, hold: 0.01, release: 0.06, peak: 0.12, glideTo: 900 });
      break;
    case 'correct':
      tone(c, out, { freq: G5, type: 'sine', hold: 0.06, release: 0.35, peak: 0.28 });
      tone(c, out, { freq: C6, type: 'sine', start: 0.11, hold: 0.08, release: 0.5, peak: 0.28 });
      tone(c, out, { freq: C6 * 2, type: 'sine', start: 0.11, hold: 0.02, release: 0.3, peak: 0.05 });
      break;
    case 'bonus':
      [C5, E5, G5, C6, E6, G6].forEach((f, i) => tone(c, out, { freq: f, type: 'sine', start: i * 0.055, hold: 0.04, release: 0.45, peak: 0.2 }));
      noise(c, out, { start: 0.1, attack: 0.05, hold: 0.05, release: 0.5, peak: 0.06, filterType: 'highpass', freq: 5000 });
      break;
    case 'miss':
      tone(c, out, { freq: D5, type: 'sine', hold: 0.08, release: 0.4, peak: 0.16 });
      tone(c, out, { freq: D5 * 0.5, type: 'triangle', start: 0.12, hold: 0.1, release: 0.5, peak: 0.1 });
      break;
    case 'whoosh':
      noise(c, out, { attack: 0.25, hold: 0.1, release: 0.7, peak: 0.16, filterType: 'bandpass', freq: 300, freqTo: 1400, q: 0.5 });
      break;
    case 'pop':
      tone(c, out, { freq: 900, type: 'sine', attack: 0.003, hold: 0.01, release: 0.12, peak: 0.25, glideTo: 300 });
      noise(c, out, { attack: 0.005, hold: 0.02, release: 0.12, peak: 0.12, filterType: 'highpass', freq: 3000 });
      break;
    case 'takeoff':
      noise(c, out, { attack: 0.4, hold: 0.3, release: 1.2, peak: 0.14, filterType: 'bandpass', freq: 200, freqTo: 900, q: 0.6 });
      tone(c, out, { freq: C5, type: 'sine', start: 0.2, attack: 0.3, hold: 0.3, release: 1.0, peak: 0.12, glideTo: G5 });
      tone(c, out, { freq: E5, type: 'sine', start: 0.5, attack: 0.3, hold: 0.3, release: 1.0, peak: 0.1, glideTo: C6 });
      break;
    case 'land':
      [C5, E5, G5].forEach((f, i) => tone(c, out, { freq: f, type: 'sine', start: i * 0.08, attack: 0.05, hold: 0.4, release: 1.4, peak: 0.16 }));
      tone(c, out, { freq: C5 / 2, type: 'triangle', attack: 0.1, hold: 0.5, release: 1.6, peak: 0.08 });
      break;
    case 'stroke':
      tone(c, out, { freq: E6, type: 'sine', attack: 0.005, hold: 0.04, release: 0.4, peak: 0.16 });
      tone(c, out, { freq: E6 * 2, type: 'sine', attack: 0.005, hold: 0.02, release: 0.2, peak: 0.04 });
      break;
    case 'mastered':
      [C5, E5, G5, C6].forEach((f, i) => tone(c, out, { freq: f, type: 'triangle', start: i * 0.12, attack: 0.02, hold: 0.12, release: 0.5, peak: 0.16 }));
      [C6, E6, G6].forEach((f, i) => tone(c, out, { freq: f, type: 'sine', start: 0.5 + i * 0.07, attack: 0.02, hold: 0.3, release: 1.2, peak: 0.14 }));
      noise(c, out, { start: 0.5, attack: 0.05, hold: 0.1, release: 0.8, peak: 0.07, filterType: 'highpass', freq: 4500 });
      break;
  }
}

/**
 * A very quiet wind + sea bed under the flight — two filtered noise
 * layers with slow independent swells, so it never loops audibly.
 * Fades in over ~2s; `stopAmbient()` fades it out the same way.
 */
export function startAmbient(): void {
  const r = ready();
  if (!r || ambient) return;
  const { c, out } = r;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(1, c.currentTime + 2.5);
  gain.connect(out);

  function layer(freq: number, q: number, level: number, lfoHz: number, lfoDepth: number): AudioScheduledSourceNode[] {
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = level;
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = lfoHz;
    const lfoGain = c.createGain();
    lfoGain.gain.value = lfoDepth;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(gain);
    src.start();
    lfo.start();
    return [src, lfo];
  }
  const nodes = [...layer(420, 0.4, 0.05, 0.11, 0.025), ...layer(140, 0.7, 0.06, 0.07, 0.03), ...layer(1800, 0.3, 0.012, 0.19, 0.008)];
  ambient = {
    gain,
    stop: () => {
      const now = c.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.2);
      nodes.forEach((n) => n.stop(now + 1.3));
    },
  };
}

export function stopAmbient(): void {
  if (!ambient) return;
  ambient.stop();
  ambient = null;
}

/** Duck the ambient bed (e.g. while a HUD card is open and the letter is being spoken) — 1 = full, 0 = silent. */
export function setAmbientLevel(level: number): void {
  if (!ambient || !ctx) return;
  ambient.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.3);
}

/** Gentle haptic tick where supported (Android Chrome); silently ignored elsewhere. */
export function haptic(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw on vibrate() without a user gesture — never let a haptic break gameplay.
  }
}
