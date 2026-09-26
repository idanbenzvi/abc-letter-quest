// Menu theme song — a single looping background track behind the
// starting menu (PlayerSelect). A plain <audio> element rather than
// Web Audio (engine/sfx.ts) since this is one static file, not a
// synthesized cue.
//
// Browser autoplay rules: an <audio> element with sound can only start
// playback inside (or very soon after) a user gesture. `play()` is safe
// to call anytime — if the browser blocks it, `resume()` retries from
// inside a click/tap handler.

const SRC = '/audio/theme.mp3';
// Quiet on purpose — this plays behind a child trying to hear a letter's
// name or sound, which is the actual lesson; the music is ambience, not
// something competing for attention. See also duck()/unduck() below,
// which pull it down further still for the moment something's read
// aloud.
const VOLUME = 0.14;
const DUCK_SCALE = 0.2; // fraction of VOLUME that survives while ducked
const DUCK_FADE_MS = 180;
const FADE_MS = 500;
const MUTE_KEY = 'abc-letter-quest:menu-music-muted';

let el: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let duckTimer: ReturnType<typeof setInterval> | null = null;
// Counted, not boolean — engine/audio.ts's speak() calls duck()/unduck()
// around every letter readout, and a fast double-tap can start a second
// speak() before the first one's unduck() runs; the count only lets the
// music back up once every in-flight readout is done, not just the last.
let duckDepth = 0;

function targetVolume(): number {
  if (isMuted()) return 0;
  return duckDepth > 0 ? VOLUME * DUCK_SCALE : VOLUME;
}

function rampTo(target: number, ms: number): void {
  if (!el) return;
  const a = el;
  if (duckTimer) {
    clearInterval(duckTimer);
    duckTimer = null;
  }
  const steps = 6;
  const start = a.volume;
  const delta = target - start;
  if (Math.abs(delta) < 0.002) {
    a.volume = target;
    return;
  }
  let step = 0;
  duckTimer = setInterval(() => {
    step++;
    a.volume = step >= steps ? target : start + delta * (step / steps);
    if (step >= steps) {
      clearInterval(duckTimer!);
      duckTimer = null;
    }
  }, ms / steps);
}

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!el) {
    el = new Audio(SRC);
    el.loop = true;
    el.volume = targetVolume();
  }
  return el;
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Losing this preference silently is fine — it just falls back to unmuted next load.
  }
  if (el) el.volume = targetVolume();
}

/** Pull the music down while a letter is being read aloud (engine/audio.ts's speak()) — never fully silent, so rapid taps don't produce an audible on/off blip, just quiet enough to not compete with speech. Pair every call with unduck(). */
export function duck(): void {
  duckDepth++;
  if (!el || el.paused) return;
  rampTo(targetVolume(), DUCK_FADE_MS);
}

/** Releases one duck() — the music only actually comes back up once every in-flight duck() has a matching unduck(). */
export function unduck(): void {
  duckDepth = Math.max(0, duckDepth - 1);
  if (duckDepth > 0 || !el || el.paused) return;
  rampTo(targetVolume(), DUCK_FADE_MS);
}

/** Start the theme looping. Safe to call anytime; silently no-ops if the browser blocks autoplay until a gesture calls resume(). */
export function play(): void {
  const a = getAudio();
  if (!a) return;
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  a.volume = targetVolume();
  void a.play().catch(() => {
    // Blocked until a user gesture — resume() retries.
  });
}

/** Call from inside a click/tap handler to retry playback if autoplay was blocked. */
export function resume(): void {
  if (!el || !el.paused) return;
  void el.play().catch(() => {
    // Still no gesture context (e.g. a synthetic event) — next real tap will retry.
  });
}

/** Fade out and pause — call on unmount when leaving the starting menu. */
export function fadeOutAndStop(): void {
  const a = el;
  if (!a || a.paused) return;
  if (fadeTimer) clearInterval(fadeTimer);
  if (duckTimer) {
    clearInterval(duckTimer);
    duckTimer = null;
  }
  const steps = 10;
  const startVolume = a.volume;
  let step = 0;
  fadeTimer = setInterval(() => {
    step++;
    a.volume = Math.max(0, startVolume * (1 - step / steps));
    if (step >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      a.pause();
      a.currentTime = 0;
    }
  }, FADE_MS / steps);
}
