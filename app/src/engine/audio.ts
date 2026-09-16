// Audio strategy — see docs/07-architecture.md#audio-strategy.
//
// Two layers: pre-recorded real speech (preferred, if the file exists)
// falling back to the browser's built-in speech synthesis (always
// available, no asset dependency). Recorded audio is checked first for
// every letter — see "Recorded letter audio" below for exactly what
// file each letter expects and how to add one.

import { spokenLetterName } from './letterNameMatch';

// Curated, quality-ranked list of known-good female English
// SpeechSynthesis voice names, derived (CC0 / BSD-3-Clause) from
// https://github.com/readium/speech and
// https://github.com/HadrienGardeur/web-speech-recommended-voices —
// a community-maintained dataset of which voice names are actually
// high quality per platform/browser, since the Web Speech API itself
// exposes no quality signal. Ordered best-to-worst; not exhaustive — a
// voice not listed here still gets picked up by the "female" substring
// fallback below, just without priority ordering.
const KNOWN_FEMALE_VOICES = [
  // Windows/Edge "Online (Natural)" voices — free, no setup, very high quality neural voices.
  'Microsoft EmmaMultilingual Online (Natural) - English (United States)',
  'Microsoft Emma Online (Natural) - English (United States)',
  'Microsoft AvaMultilingual Online (Natural) - English (United States)',
  'Microsoft Ava Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Michelle Online (Natural) - English (United States)',
  'Microsoft Ana Online (Natural) - English (United States)', // labeled for children's content in the source dataset
  'Microsoft Sonia Online (Natural) - English (United Kingdom)',
  'Microsoft Libby Online (Natural) - English (United Kingdom)',
  'Microsoft Maisie Online (Natural) - English (United Kingdom)', // labeled for children's content
  // Chrome desktop's built-in network voice — free, no setup, works on Linux/macOS/Windows Chrome.
  'Google US English',
  'Google UK English Female',
  'Google US English 5 (Natural)',
  'Google US English 1 (Natural)',
  'Google US English 2 (Natural)',
  'Google US English 7 (Natural)',
  'Google UK English 2 (Natural)',
  'Google UK English 4 (Natural)',
  'Google UK English 6 (Natural)',
  // Lower quality but reliably present as a last resort before the
  // generic "female" substring fallback kicks in.
  'Microsoft Zira - English (United States)',
  'Microsoft Hazel - English (Great Britain)',
  'Samantha',
  'Karen',
  'Moira',
  'Tessa',
  'Victoria',
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  if (!v.lang.toLowerCase().startsWith('en')) return -1;
  const knownIndex = KNOWN_FEMALE_VOICES.indexOf(v.name);
  if (knownIndex !== -1) return 1000 - knownIndex;
  // Only fall back to a guess when the browser's own name says "female"
  // — never assign a gendered voice from a bare heuristic on the name.
  if (v.name.toLowerCase().includes('female')) return 10;
  return -1;
}

function pickBestFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const scored = voices.map((v) => ({ v, s: scoreVoice(v) })).filter((x) => x.s >= 0);
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.s - a.s);
  return scored[0].v;
}

let voicesReadyPromise: Promise<void> | null = null;

// getVoices() is often empty until the async voiceschanged event fires
// (sometimes never, on some browsers) — wait once, briefly, rather than
// racing it on every single speak() call.
function ensureVoicesLoaded(): Promise<void> {
  if (voicesReadyPromise) return voicesReadyPromise;
  voicesReadyPromise = new Promise((resolve) => {
    if (window.speechSynthesis.getVoices().length > 0) {
      resolve();
      return;
    }
    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    setTimeout(resolve, 1500);
  });
  return voicesReadyPromise;
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function speakSynthesized(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // don't queue overlapping taps
  const utterance = new SpeechSynthesisUtterance(text);
  if (cachedVoice) utterance.voice = cachedVoice;
  utterance.rate = 0.92;
  // Natural, unmodified pitch — artificially raising pitch was meant to
  // sound "friendlier" but makes an already-good voice sound worse; it
  // only ever helped disguise a low-quality fallback voice.
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Recorded letter audio — drop a file at public/audio/letters/<LETTER>.mp3
// (e.g. public/audio/letters/A.mp3) for any letter you've generated real
// speech for (ElevenLabs, or any other TTS/recording source); nothing
// else needs to change. Missing files fall back to speech synthesis
// silently — you can add letters incrementally, in any order, and the
// app never needs a full set to work. See public/audio/letters/README.md.
const RECORDED_AUDIO_BASE = '/audio/letters/';
const audioCache = new Map<string, HTMLAudioElement>();
const confirmedMissing = new Set<string>(); // letters we've already 404'd on — don't retry every tap

let currentRecordedAudio: HTMLAudioElement | null = null;

// How long to wait for a recorded clip to start before giving up and
// falling back to synthesis. Same lesson as the speech-to-text bonus
// challenge's "stranded on Listening..." bug (docs/09-roadmap.md): never
// trust a browser media event to fire promptly, or at all — a missing
// file's `error` event should be near-instant in practice, but this is
// the safety net if it isn't (confirmed necessary: caught by an actual
// test where `error` never fired for a 404'd file, silently hanging
// `speak()` forever with no fallback and no crash).
const RECORDED_AUDIO_TIMEOUT_MS = 1200;

function playRecordedLetter(letter: string): Promise<boolean> {
  if (confirmedMissing.has(letter)) return Promise.resolve(false);

  return new Promise((resolve) => {
    let audio = audioCache.get(letter);
    if (!audio) {
      audio = new Audio(`${RECORDED_AUDIO_BASE}${letter}.mp3`);
      audioCache.set(letter, audio);
    }

    let settled = false;
    // Armed before the listeners are attached (function declarations
    // below are hoisted) — same tick either way, and it keeps this a
    // single `const` rather than a `let` assigned later.
    const timeoutId = setTimeout(onError, RECORDED_AUDIO_TIMEOUT_MS);
    function settle(played: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      audio!.removeEventListener('error', onError);
      audio!.removeEventListener('ended', onEnded);
      audio!.removeEventListener('canplay', onCanPlay);
      resolve(played);
    }
    function onError() {
      confirmedMissing.add(letter);
      settle(false);
    }
    function onEnded() {
      settle(true);
    }
    function onCanPlay() {
      // Confirmed real, playable audio — safe to stop waiting for the
      // timeout even if `ended` (a short clip) is still a moment away.
      clearTimeout(timeoutId);
    }

    audio.addEventListener('error', onError, { once: true });
    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('canplay', onCanPlay, { once: true });
    audio.currentTime = 0;
    currentRecordedAudio = audio;
    audio.play().catch(onError);
  });
}

export async function speak(text: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Don't let a previous tap's audio (recorded or synthesized) keep
  // playing under a new one.
  if (currentRecordedAudio) {
    currentRecordedAudio.pause();
    currentRecordedAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  const letter = text.trim().toUpperCase();
  if (/^[A-Z]$/.test(letter)) {
    const played = await playRecordedLetter(letter);
    if (played) return;
  }

  if (!window.speechSynthesis) return;
  await ensureVoicesLoaded();
  if (cachedVoice === undefined) cachedVoice = pickBestFemaleVoice();
  speakSynthesized(/^[A-Z]$/.test(letter) ? spokenLetterName(letter) : text);
}
