// Audio strategy — see docs/07-architecture.md#audio-strategy.
//
// Two layers: pre-recorded real speech (preferred, if the file exists)
// falling back to the browser's built-in speech synthesis (always
// available, no asset dependency). Recorded audio is checked first for
// every letter AND every word — see "Recorded audio" below for exactly
// what file each expects and how the set was generated.

import { spokenLetterName } from './letterNameMatch';
import { WORDS } from '../data/words';
import { FLASHCARDS } from '../data/flashcards';
import { CVC_WORDS } from '../data/cvcWords';
import type { LetterVoice } from '../types';
import * as music from './music';

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

// How long an utterance is allowed to duck the music for before giving up
// on ever hearing `onend`/`onerror` and letting it back up anyway — the
// same "never trust a browser media event to fire promptly, or at all"
// lesson as RECORDED_AUDIO_TIMEOUT_MS below, applied here because an
// utterance that never resolves would otherwise duck the music silent
// for the rest of the session. Generous on purpose: this brackets an
// entire spoken word/phrase, not just "did playback start."
const SYNTHESIS_TIMEOUT_MS = 6000;

/** Resolves once the utterance finishes (or errors, or the timeout above elapses) — callers duck music.ts around this, so it must resolve even when the browser's own completion event doesn't fire. */
function speakSynthesized(text: string): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel(); // don't queue overlapping taps
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const utterance = new SpeechSynthesisUtterance(text);
    if (cachedVoice) utterance.voice = cachedVoice;
    utterance.rate = 0.92;
    // Natural, unmodified pitch — artificially raising pitch was meant to
    // sound "friendlier" but makes an already-good voice sound worse; it
    // only ever helped disguise a low-quality fallback voice.
    utterance.pitch = 1.0;
    utterance.onend = settle;
    utterance.onerror = settle;
    setTimeout(settle, SYNTHESIS_TIMEOUT_MS);
    synth.speak(utterance);
  });
}

// Recorded audio — drop a file at public/audio/letters/<LETTER>.wav (e.g.
// public/audio/letters/A.wav) for a letter, or public/audio/words/<id>.wav
// for a word, and nothing else needs to change. Missing files fall back
// to speech synthesis silently — you can add clips incrementally, in any
// order, and the app never needs a full set to work. The full set
// shipped with this app was generated by assets/generate-audio.mjs (a
// warm Gemini TTS voice), but the file-based lookup here doesn't care
// how a given clip was made — see public/audio/letters/README.md and
// public/audio/words/README.md.
const RECORDED_LETTER_AUDIO_BASE = '/audio/letters/';
const RECORDED_WORD_AUDIO_BASE = '/audio/words/';
const RECORDED_SOUND_AUDIO_BASE = '/audio/sounds/';
const soundAudioCache = new Map<string, HTMLAudioElement>();
const confirmedMissingSounds = new Set<string>();
const letterAudioCache = new Map<string, HTMLAudioElement>();
const wordAudioCache = new Map<string, HTMLAudioElement>();
const confirmedMissingLetters = new Set<string>(); // letters we've already 404'd on — don't retry every tap
const confirmedMissingWords = new Set<string>(); // word ids we've already 404'd on — don't retry every tap

// Maps a word's displayed text (normalized) to the id its recorded clip
// is filed under — built once from every place a whole word gets spoken,
// so `speak("Fire Truck")` finds `words/firetruck.wav` and
// `speak("CAT")` (the CVC blending round) reuses `words/cat.wav`
// (the same clip words.ts's "Cat" flashcard uses — same sound either way).
function normalizeWordKey(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}
const WORD_ID_BY_KEY = new Map<string, string>();
for (const entry of [...WORDS, ...FLASHCARDS, ...CVC_WORDS]) {
  const key = normalizeWordKey(entry.word);
  if (!WORD_ID_BY_KEY.has(key)) WORD_ID_BY_KEY.set(key, entry.id);
}

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

/**
 * One quick HEAD request, the first time a clip is asked for, to learn
 * whether it's really there. A missing file doesn't reliably 404: Vite's
 * dev server — and most static hosts with a single-page-app fallback —
 * answer it with index.html (200, text/html), which an <audio> element
 * then sits on until RECORDED_AUDIO_TIMEOUT_MS gives up. That made every
 * letter without a recorded clip pause for over a second before being
 * spoken (measured: 1.2s, found while adding letter sounds). Checking the
 * content type up front turns that into an immediate fallback.
 */
async function clipExists(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECORDED_AUDIO_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('audio/');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function playRecordedClip(
  url: string,
  key: string,
  cache: Map<string, HTMLAudioElement>,
  missing: Set<string>,
): Promise<boolean> {
  if (missing.has(key)) return false;
  if (!cache.has(key) && !(await clipExists(url))) {
    missing.add(key);
    return false;
  }

  return new Promise((resolve) => {
    let audio = cache.get(key);
    if (!audio) {
      audio = new Audio(url);
      cache.set(key, audio);
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
      missing.add(key);
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

function playRecordedLetter(letter: string): Promise<boolean> {
  return playRecordedClip(`${RECORDED_LETTER_AUDIO_BASE}${letter}.wav`, letter, letterAudioCache, confirmedMissingLetters);
}

function playRecordedWord(id: string): Promise<boolean> {
  return playRecordedClip(`${RECORDED_WORD_AUDIO_BASE}${id}.wav`, id, wordAudioCache, confirmedMissingWords);
}

// Bumped by every speech call. A multi-part utterance (sayLetter's
// "name… then sound") checks it between parts, so a newer tap cancels
// the rest of an older sequence instead of talking over itself.
let speechSeq = 0;

export async function speak(text: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const mine = ++speechSeq;

  // Don't let a previous tap's audio (recorded or synthesized) keep
  // playing under a new one.
  if (currentRecordedAudio) {
    currentRecordedAudio.pause();
    currentRecordedAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  // The menu theme (engine/music.ts) ducks for the whole time a letter
  // is actually being read aloud — this is the one function every path
  // that speaks a letter or word goes through, so ducking here covers
  // all of them rather than needing every call site to remember to.
  music.duck();
  try {
    const letter = text.trim().toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      const played = await playRecordedLetter(letter);
      if (played) return;
    } else {
      const wordId = WORD_ID_BY_KEY.get(normalizeWordKey(text));
      if (wordId) {
        const played = await playRecordedWord(wordId);
        if (played) return;
      }
    }

    // A newer speech call arrived while this one was still finding out
    // whether a recorded clip exists — it owns the voice now; falling
    // through to synthesis here would talk over it.
    if (speechSeq !== mine || !window.speechSynthesis) return;
    await ensureVoicesLoaded();
    if (cachedVoice === undefined) cachedVoice = pickBestFemaleVoice();
    await speakSynthesized(/^[A-Z]$/.test(letter) ? spokenLetterName(letter) : text);
  } finally {
    music.unduck();
  }
}

/**
 * A letter's SOUND (/b/), not its name — see data/letterSounds.ts. Only a
 * recorded clip in public/audio/sounds/<LETTER>.wav is used (generated by
 * assets/generate-audio.mjs --only=sounds, or dropped in by hand). Speech
 * synthesis can't say an isolated sound: the spelled-out approximations
 * came out as "ef ef ef" / "es es es", so without a clip the letter's NAME
 * is said instead — a round that needs to voice the letter still does.
 */
export async function speakLetterSound(letter: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = letter.trim().toUpperCase();
  const mine = speechSeq + 1;
  const played = await playLetterSoundClip(key);
  // A newer speech call took over mid-probe: it owns the voice now.
  if (!played && speechSeq === mine) await speak(key);
}

/** Plays the recorded sound clip for a letter; false when there's none (or a newer call took over). */
async function playLetterSoundClip(key: string): Promise<boolean> {
  ++speechSeq;
  if (currentRecordedAudio) {
    currentRecordedAudio.pause();
    currentRecordedAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  music.duck();
  try {
    return await playRecordedClip(`${RECORDED_SOUND_AUDIO_BASE}${key}.wav`, key, soundAudioCache, confirmedMissingSounds);
  } finally {
    music.unduck();
  }
}

/**
 * How the game says a letter, per the grown-ups' "Letter voice" setting:
 * its name ("bee"), its sound ("buh"), or both — name first, then sound,
 * which is the default (docs/02-pedagogy.md: the sound "before or
 * alongside" the name).
 */
export async function sayLetter(letter: string, voice: LetterVoice): Promise<void> {
  if (voice === 'sounds') return speakLetterSound(letter);
  const name = speak(letter);
  if (voice === 'names') return name;
  const mine = speechSeq;
  await name;
  if (speechSeq !== mine) return;
  // No recorded sound clip yet → the name alone (speakLetterSound's
  // fallback would just say the name a second time).
  const key = letter.trim().toUpperCase();
  if (confirmedMissingSounds.has(key)) return;
  await new Promise((r) => setTimeout(r, 180));
  if (speechSeq !== mine) return;
  await playLetterSoundClip(key);
}
