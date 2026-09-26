// Flight-mission background music — a single looping track behind
// active flight only (see FlightGameScreen.tsx's phase==='flying'
// effect). Distinct from the starting-menu theme (engine/music.ts),
// which fades out the moment takeoff happens — before this, the actual
// flying phase had no music at all, just sfx.ts's wind/sea ambient bed.
// Same plain-<audio> shape as music.ts (one static file, not a
// synthesized cue) — see public/audio/README.md for the drop-in file
// this expects; missing it is a silent no-op, same as every other
// optional asset in this app (public/audio/letters/, public/models/letters/).

const SRC = '/audio/flight-theme.mp3';
const VOLUME = 0.5;
const FADE_MS = 900;

let el: HTMLAudioElement | null = null;
let muted = false;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!el) {
    el = new Audio(SRC);
    el.loop = true;
    el.volume = muted ? 0 : VOLUME;
  }
  return el;
}

/** Mirrors the player's soundEnabled setting — call alongside sfx.setMuted(), not its own independent toggle (unlike menu.ts's, this only ever plays inside FlightGameScreen, where that setting is already in scope). */
export function setMuted(value: boolean): void {
  muted = value;
  if (el) el.volume = value ? 0 : VOLUME;
}

/** Start the flight track looping, at 50% volume. Safe to call anytime, including with no dedicated track dropped in yet — a rejected play() (404, or autoplay still blocked) just leaves the flight silent, same as every other optional asset here. */
export function play(): void {
  const a = getAudio();
  if (!a) return;
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  a.volume = muted ? 0 : VOLUME;
  void a.play().catch(() => {
    // No dedicated track dropped in yet (public/audio/README.md), or
    // autoplay still blocked — "Take Off!" is itself a user gesture, so
    // in practice this is almost always the missing-file case.
  });
}

/** Fade out and pause — call the moment the flying phase ends (mission summary, or leaving the screen mid-flight). */
export function fadeOutAndStop(): void {
  const a = el;
  if (!a || a.paused) return;
  if (fadeTimer) clearInterval(fadeTimer);
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
