import { useState, useRef, useEffect, useMemo, Suspense, lazy } from 'react';
import { useApp } from '../state/AppContext';
import { speak, sayLetter, speakLetterSound } from '../engine/audio';
import * as sfx from '../engine/sfx';
import * as music from '../engine/music';
import * as flightMusic from '../engine/flightMusic';
import { preloadFonts, isTouchOnlyDevice } from '../engine/preload';
import { requestTiltPermission, recenterTilt, isTiltCapable } from '../engine/tilt';
import { buildMissionQueue, pickEndlessItem, buildNameQueue, MISSION_LENGTH } from '../engine/flightMission';
import { buildVowelRound, type VowelRound } from '../engine/vowelRound';
import { VowelStorm, type VowelStormState } from '../components/VowelStorm';
import { buildPictureChoices, type PictureChoiceEntry } from '../engine/pictureChoice';
import { buildPlaneChoiceRound, type PlaneChoiceRound } from '../engine/planeChoice';
import { buildRainbowRound, RAINBOW_COLORS, type RainbowColor, type RainbowRound } from '../engine/rainbowChoice';
import { buildOddSoundRound, type OddSoundRound } from '../engine/oddSound';
import { FLASHCARD_MAP } from '../data/flashcards';
import { letterForSound } from '../data/initialSounds';
import { confusablePartnersFor } from '../data/confusablePairs';
import { randomCvcWord } from '../data/cvcWords';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SpeakerIcon,
  StarIcon,
  KeyboardIcon,
  PauseIcon,
  PlayIcon,
  NestIcon,
  SoundOnIcon,
  SoundOffIcon,
  HandTapIcon,
  TraceIcon,
  MicIcon,
  PictureIcon,
  GrownUpIcon,
  CloudIcon,
  SwapCaseIcon,
  FlameIcon,
  InfoIcon,
  CloseIcon,
  CameraIcon,
} from '../components/icons/Misc';
import { NestIllustration } from '../components/icons/NestIllustration';
import { SkyBackdrop } from '../components/SkyBackdrop';
import { AvatarIcon } from '../components/icons/AvatarIcon';
import { ScreenTransition } from '../components/ScreenTransition';
import { HoldButton } from '../components/HoldButton';
import { KeyArt } from '../components/Brand';
import { WritingPractice } from '../components/WritingPractice';
import { SpeechLetterButton, type SpeechLetterButtonHandle } from '../components/SpeechLetterButton';
import { AsciiCredit } from '../components/AsciiCredit';
import { HandwritingCheck } from '../components/HandwritingCheck';
import { DevOceanPanel } from './DevOceanPanel';
import { OCEAN_SKY_DEFAULTS, type OceanDevParams } from './oceanSky';
import { FlightLoadingVeil } from './FlightLoadingVeil';
import { isTraceInProgress } from '../engine/traceActivity';
import type { Encounter, QueueItem } from './flightTypes';
import { preloadFlashCardTextures } from './flashCardTexture';
import './FlightGameScreen.css';

// How far ahead of the bird's own current position every new letter
// spawns — including the very first one, so every letter looks exactly
// as far away when it first appears, not just the first. This used to
// be tracked as a running total (nextSpawnDistanceRef += a fixed step)
// which drifted further and further from the bird's actual position the
// faster a child answered — a quick correct answer barely closes any of
// the previous gap before the next letter gets scheduled another fixed
// step past it, so letters read as spawning progressively farther away
// the better the child was doing. Anchoring every spawn to the bird's
// live distance at that moment (see handleFadeComplete) fixes that.
//
// 32 (was 26): at 4 units/s that's ~8 seconds from "a new cloud appears"
// to "flown through it" instead of ~6.5. Tapping freezes the flight, so
// the child only has to *notice and tap* in that window — but noticing
// three picture-choice icons AND the letter in 6.5s was tight for a
// six-year-old in playtesting.
const SPAWN_DISTANCE_AHEAD = 32;
// Typing the letter on a physical keyboard is a shortcut past the tap +
// self-report loop — it's unambiguous proof the child knows it, so it's
// worth more than the usual self-reported "knew it" star.
const TYPE_BONUS_STARS = 2;
// A trace freezes the flight from the first touch; the freeze lingers
// this long after the finger lifts so a two- or three-stroke letter can
// be drawn with pauses between strokes, at a child's own pace, without
// the cloud drifting away in between.
const TRACE_HOLD_RELEASE_MS = 2500;
// After a trace is completed the whole cloud + ribbon flash gold for
// this long before the bubble-burst pops it — the "you did it" beat.
const TRACE_GLOW_MS = 300;
// Every Nth completed trace opens the lined writing page for that letter
// (components/WritingPractice.tsx) before the next cloud spawns — the
// bridge from tracing a shape to writing it. Parent-configurable off.
const WRITING_EVERY_N_TRACES = 3;
const WRITING_STARS = 2;

// Combo streak: every correct catch in a row (any path — tap+"knew it",
// typed, spoken, traced, or picture-picked) builds the streak; a miss of
// any kind resets it to 0. Every STREAK_MILESTONE-th catch in the current
// streak throws in an extra bonus star on top of whatever that catch
// already earned — the "feedback" half of the mechanic (the HUD badge
// below) is constant, but the milestone bonus is what gives it real
// stakes without turning every single catch into a bigger-number-fest a
// 6-year-old can't track.
const STREAK_MILESTONE = 3;
const STREAK_BONUS_STARS = 1;

// Streak reward: every RAINBOW_STREAK-th catch in a row has a
// RAINBOW_CHANCE shot at a rainbow round ("which colour is glowing?" —
// see engine/rainbowChoice.ts) in front of the NEXT letter. Rolled at
// the milestone, shown on the next presentItem, so it never cuts into
// the cloud the child just solved. A surprise, not a schedule — rare
// enough that it still feels like one.
const RAINBOW_STREAK = 5;
const RAINBOW_CHANCE = 0.2;
const RAINBOW_BONUS_STARS = 2;
// How long the win toast stays up — long enough to hear the colour word (and its letter, when it matches).
const RAINBOW_WIN_PAUSE_MS = 1800;
const RAINBOW_PROMPT = 'Which colour is glowing?';

// The storm round: "which one starts with a different sound?" (see
// engine/oddSound.ts). A chance per letter turn, and only for a letter
// whose cards can make a fair pair — engine/oddSound.ts returns null for
// U and X, and the storm just doesn't come that turn.
const STORM_CHANCE = 0.2;
const STORM_BONUS_STARS = 3;
// How long the clearing (rain stopping, the sunburst, the odd card's
// name) plays before the storm round ends and the held letter's cloud comes.
const STORM_CLEAR_MS = 3200;
// After this many wrong picks the odd card starts to glow — a nudge, so
// a child who's stuck always gets there (errorless-leaning feedback).
const STORM_HINT_AFTER = 2;
const STORM_PROMPT = 'Which one starts with a different sound?';

interface StormRoundState extends OddSoundRound {
  wrongId: string | null;
  solved: boolean;
  misses: number;
  hint: boolean;
}

const cardWord = (id: string) => FLASHCARD_MAP[id]?.word ?? id;

// Demo-only shortcuts, enabled by opening the game with ?dev=true.
// Alt+R queues a rainbow in front of the next letter; Alt+S toggles a
// storm right now (see devToggleStorm), Alt+V a Storm Vowels round. Plain R/S would collide with
// typing that letter as an answer. Read once at load.
const DEV_SHORTCUTS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'true';

// Every PLANE_ROUND_EVERY-th queue item is presented as a plane-choice
// round (see engine/planeChoice.ts) instead of a normal letter cloud —
// counted across ALL presented items regardless of mode, reset on every
// Take Off. Occasional enough to stay a fun change-of-pace rather than
// the dominant mechanic; not gated by reading level or mode, since
// hearing a letter's name and finding its glyph is a skill every level
// still benefits from practicing.
const PLANE_ROUND_EVERY = 4;

// A letter-matchup round only ever replaces an item that HAS a curated
// look-alike (see data/confusablePairs.ts) — most letters don't, so this
// is the chance it fires for one that does, not the chance across all
// letters. Checked ahead of the plane-round cadence in presentItem: the
// two never compete for the same item.
const LETTER_MATCHUP_CHANCE = 0.5;

// Once a letter has been missed this many times in the CURRENT flight
// (see missStreakRef), its next appearance steers toward the trace hint
// instead of the normal rotating one — tracing is the one path research
// (see data/research.ts) specifically ties to stronger letter-sound
// integration, so it's the most useful nudge for a letter that's clearly
// giving this child trouble right now, not a punishment for missing it.
const STRUGGLE_THRESHOLD = 2;

// "Catch the letters in order, blend them into a word" — the first step
// past single-letter recognition into actual reading (see
// data/cvcWords.ts). Rarer than the plane/matchup bonuses (it's a bigger
// ask — 3 correct taps in a specific order, not one), and checked FIRST
// in presentItem: unlike plane-choice/letter-matchup, it doesn't replace
// the queue item it interrupts — that item is stashed in
// pendingPresentRef and re-presented once the word's caught, so it still
// gets its own fair shot at becoming a normal/plane/matchup round.
// 5, not a bigger number: classic mode's whole mission is only
// MISSION_LENGTH (6) items long, and a cadence much longer than that
// would mean most classic flights never see this at all — checked
// directly against that constant, not picked arbitrarily.
const CVC_ROUND_EVERY = 5;
const CVC_BONUS_STARS = 4;
// Long enough to hear the whole word spoken (see handleCvcSlotTap) before the planes/letters vanish and flight resumes.
const CVC_WORD_PAUSE_MS = 1900;

interface CvcRoundState {
  /** Stable for the whole round (the CvcWord's own id) — unlike the object itself, which gets a fresh `nextIndex` on every correct tap. FlightScene keys its frozen-distance snapshot on this, not on the whole object. */
  id: string;
  letters: [string, string, string];
  /** Index (0-2) of the next letter that must be tapped. */
  nextIndex: number;
}

interface LetterMatchupState {
  /** Canonical (uppercase) target letter — what handleMatchupPick compares a tap against. */
  target: string;
  /** The two lowercase options, in the display order shown. */
  options: [string, string];
}

// The whole three.js / R3F stack is code-split behind this — see
// FlightCanvas.tsx. Loaded (and its bird mesh preloaded) during the
// intro so a flight never waits on it in practice.
const FlightCanvas = lazy(() => import('./FlightCanvas'));
function loadFlightChunk(): Promise<void> {
  return Promise.all([import('./FlightCanvas'), import('./flightPreload').then((m) => m.preloadFlightAssets())]).then(() => undefined);
}

function randomLane(): number {
  return Math.random() * 6 - 3;
}

type Phase = 'intro' | 'flying' | 'end';
type EndReason = 'collected' | 'time' | 'endless' | 'sprint' | 'landed';
type Mode = 'classic' | 'endless' | 'sprint' | 'name';
/** Per-letter outcome recorded for the HUD slots + end screen. Last outcome wins for a letter that repeats (endless mode). */
type Outcome = 'knew' | 'bonus' | 'missed';
// Sprint mode's time penalty/reward — see FlightScene's sprintTimeAdjust doc comment.
const SPRINT_BONUS_SECONDS = 3;
const SPRINT_MISTAKE_SECONDS = -2;

const MODE_COPY: Record<Mode, { label: string; blurb: string }> = {
  classic: { label: 'Classic', blurb: `Find ${MISSION_LENGTH} letters before the stars come out.` },
  endless: { label: 'Endless', blurb: 'Keep flying as long as you can — every letter you know pushes night back a little.' },
  sprint: { label: 'Sprint', blurb: 'A race against the sun: a bonus buys extra daylight, a miss makes it set faster.' },
  // The blurb is personalised at render time (see modeBlurb) — it needs the child's name.
  name: { label: 'My Name', blurb: 'Fly the letters of your own name!' },
};

/** Modes with a fixed letter plan and HUD slots (vs endless/sprint's open-ended stream). */
const isPlannedMode = (m: Mode) => m === 'classic' || m === 'name';

// Storm Vowels: "C _ T — which sound is missing?" (engine/vowelRound.ts).
// Takes over half of the CVC-word cadence's turns (the other half stay
// the catch-in-order word round) — they practise the same kind of word.
const VOWEL_STORM_SHARE = 0.5;
const VOWEL_BONUS_STARS = 4;
const VOWEL_HINT_AFTER = 2;
// The lightning strike, the gold word, and the blend "kuh… ah… tuh… cat" play out before the letter's cloud returns.
const VOWEL_CLEAR_MS = 4200;
const VOWEL_PROMPT = 'Which sound is missing?';

function spawnEncounter(item: QueueItem, distance: number): Encounter {
  return { ...item, distance, laneX: randomLane(), status: 'pending' };
}

/**
 * The flight game's outer half — owns mission/React state and the DOM
 * HUD/intro/end screens; FlightScene.tsx owns the R3F/Three.js tree
 * and the per-frame mission clock. See docs/10-flight-game.md for the
 * full design.
 */
/** A little egg for the "My nest" buttons. */
function NestEggIcon() {
  return (
    <svg viewBox="0 0 24 28" width="18" height="21" aria-hidden="true">
      <path d="M12 1.5C18 1.5 22.5 11 22.5 17.5S18 26.5 12 26.5 1.5 24 1.5 17.5 6 1.5 12 1.5Z" fill="#fff6e2" stroke="#b07a3e" strokeWidth="2" />
      <path d="M13.5 4 12 8 14.5 10 12.5 13.5" fill="none" stroke="#7a4a22" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FlightGameScreen({ onOpenDashboard, onOpenNest }: { onOpenDashboard: () => void; onOpenNest: () => void }) {
  const { state, answer, logSession, awardStars, setSoundEnabled } = useApp();
  // CompanionFlock's unlock threshold — see FlightScene.tsx/CompanionFlock.tsx.
  const masteredLetterCount = useMemo(() => Object.values(state.letters).filter((l) => l.box >= 4).length, [state.letters]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('classic');
  const [missionPlan, setMissionPlan] = useState<QueueItem[]>([]);
  const [planIndex, setPlanIndex] = useState(0);
  const [foundCount, setFoundCount] = useState(0); // endless mode's running count — classic mode uses planIndex/missionPlan.length instead
  const [correctTick, setCorrectTick] = useState(0); // endless mode only: increments per correct answer, rewinds the night clock — see FlightScene
  const [sprintTimeAdjust, setSprintTimeAdjust] = useState(0); // sprint mode only: running total of +3/-2 adjustments — see FlightScene
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<EndReason>('collected');
  const [toast, setToast] = useState<{ text: string; kind: 'star' | 'bonus' | 'gentle' } | null>(null);
  const [streak, setStreak] = useState(0);
  const [planeChallenge, setPlaneChallenge] = useState<PlaneChoiceRound | null>(null);
  const [wrongPlaneOption, setWrongPlaneOption] = useState<string | null>(null);
  const [letterMatchup, setLetterMatchup] = useState<LetterMatchupState | null>(null);
  const [wrongMatchupOption, setWrongMatchupOption] = useState<string | null>(null);
  const [cvcRound, setCvcRound] = useState<CvcRoundState | null>(null);
  const [wrongCvcIndex, setWrongCvcIndex] = useState<number | null>(null);
  const [rainbowRound, setRainbowRound] = useState<RainbowRound | null>(null);
  const [wrongRainbowOption, setWrongRainbowOption] = useState<RainbowColor['id'] | null>(null);
  const [stormRound, setStormRound] = useState<StormRoundState | null>(null);
  const [vowelRound, setVowelRound] = useState<VowelStormState | null>(null);
  // Bumped to call down a lightning strike on Storm Vowels' finished word (FlightScene → StormWeather).
  const [strikeKey, setStrikeKey] = useState(0);
  const [pictureChoices, setPictureChoices] = useState<PictureChoiceEntry[] | null>(null);
  const [wrongPickId, setWrongPickId] = useState<string | null>(null);
  const [solvedPickId, setSolvedPickId] = useState<string | null>(null);
  const [slotOutcomes, setSlotOutcomes] = useState<Record<number, Outcome>>({});
  const [pauseOpen, setPauseOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [handwritingOpen, setHandwritingOpen] = useState(false);
  const [creditHover, setCreditHover] = useState(false);
  const creditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tracingHold, setTracingHold] = useState(false);
  const [writing, setWriting] = useState<{ letter: string } | null>(null);
  const traceCompletionsRef = useRef(0);
  const lastTraceRef = useRef<{ canonical: string; display: string } | null>(null);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);
  const traceHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const traceGlowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devOceanParams, setDevOceanParams] = useState<OceanDevParams>(() => ({ ...OCEAN_SKY_DEFAULTS }));
  const [musicMuted, setMusicMuted] = useState(music.isMuted());

  const nextSpawnDistanceRef = useRef(SPAWN_DISTANCE_AHEAD);
  const roundsUntilPlaneRef = useRef(PLANE_ROUND_EVERY);
  const roundsUntilCvcRef = useRef(CVC_ROUND_EVERY);
  // Set by registerStreak when a RAINBOW_STREAK milestone wins its roll; consumed by the next presentItem.
  const rainbowDueRef = useRef(false);
  // Dev shortcut only (Alt+S): force a storm on the next letter that can make one.
  const stormDueRef = useRef(false);
  // Bumped to cancel an in-progress read-aloud of the storm's cards (a tap, or a replay).
  const stormSpeechRef = useRef(0);
  const vowelSpeechRef = useRef(0);
  // The bird's live travelled distance, written by FlightScene every frame.
  // The rainbow is the one round the flight keeps moving through, so when
  // it ends the stashed spawn distance is stale — see endRainbowRound.
  const birdDistanceRef = useRef(0);
  // The queue item a CVC interlude deferred — presentItem re-invokes
  // itself with this once the word's caught, so that item still gets
  // its own normal/plane/matchup roll rather than being skipped outright.
  const pendingPresentRef = useRef<{ item: QueueItem; distance: number } | null>(null);
  const practicedRef = useRef<Set<string>>(new Set());
  const outcomesRef = useRef<Map<string, Outcome>>(new Map());
  // Consecutive misses on THIS letter within the current flight only —
  // separate from the persisted, cross-session mastery box the scheduler
  // already tracks. Purely so a letter that's clearly giving this child
  // trouble right now gets a gentler nudge (see STRUGGLE_THRESHOLD below),
  // not a scoring signal of its own.
  const missStreakRef = useRef<Map<string, number>>(new Map());
  const correctCountRef = useRef(0);
  const totalCountRef = useRef(0);
  const sessionStartedAtRef = useRef<string | null>(null);
  const starsAtStartRef = useRef(0);
  const masteredAtStartRef = useRef<Set<string>>(new Set());
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechButtonRef = useRef<SpeechLetterButtonHandle>(null);
  const touchOnly = useMemo(() => isTouchOnlyDevice(), []);
  const profile = state.profile;
  const focusLetters = state.settings.focusLetters;
  // The "My Name" flight's letters — empty when the name has no English
  // letters to fly (e.g. written in Hebrew), which disables that mode.
  const nameQueue = useMemo(() => buildNameQueue(profile?.name ?? ''), [profile?.name]);
  // Every letter the flight speaks goes through the grown-ups' "Letter
  // voice" setting — name, sound, or both (see engine/audio.ts's sayLetter).
  const letterVoice = state.settings.letterVoice;
  const sayLetterAloud = (letter: string) => sayLetter(letter, letterVoice);
  // The word round blends with SOUNDS — "kuh… ah… tuh… cat" — because
  // blending letter NAMES ("see… ay… tee") doesn't produce the word.
  // Only a grown-up who explicitly chose names-only gets names here.
  const blendLetter = (letter: string) => (letterVoice === 'names' ? speak(letter) : speakLetterSound(letter));

  // Warm everything the flight needs while the child is still reading
  // the intro: the 2.5MB bird mesh and the fonts the letter clouds are
  // rasterized from. Both are cached, so a second "Fly Again" is instant.
  useEffect(() => {
    void loadFlightChunk();
    void preloadFonts();
  }, []);

  useEffect(() => {
    sfx.setMuted(!state.settings.soundEnabled);
    flightMusic.setMuted(!state.settings.soundEnabled);
  }, [state.settings.soundEnabled]);

  // The starting-menu theme (also heard on PlayerSelect) continues into
  // the "Ready to fly?" intro — most sessions land here directly, since
  // a returning player skips PlayerSelect entirely. Fades out the moment
  // takeoff moves the phase past 'intro' (including "Fly Again", which
  // never re-enters 'intro' at all, so it never restarts there).
  useEffect(() => {
    if (phase !== 'intro') return;
    music.play();
    return () => music.fadeOutAndStop();
  }, [phase]);

  // The dedicated flight track (engine/flightMusic.ts) — silent until a
  // real file is dropped in (see public/audio/README.md) — plays only
  // while actually flying, at its own 50% volume, picking up right
  // where the menu theme above just faded out.
  useEffect(() => {
    if (phase !== 'flying') return;
    flightMusic.play();
    return () => flightMusic.fadeOutAndStop();
  }, [phase]);

  // Leaving the screen (dashboard, player switch) mid-ambient: fade out.
  useEffect(
    () => () => {
      sfx.stopAmbient();
      sfx.stopRain();
      if (traceHoldTimer.current) clearTimeout(traceHoldTimer.current);
      if (traceGlowTimer.current) clearTimeout(traceGlowTimer.current);
      if (creditTimerRef.current) clearTimeout(creditTimerRef.current);
    },
    [],
  );

  function handleCreditHoverStart() {
    if (creditTimerRef.current) clearTimeout(creditTimerRef.current);
    creditTimerRef.current = setTimeout(() => setCreditHover(true), 2000);
  }
  function handleCreditHoverEnd() {
    if (creditTimerRef.current) {
      clearTimeout(creditTimerRef.current);
      creditTimerRef.current = null;
    }
    setCreditHover(false);
  }

  function releaseTracingHold() {
    if (traceHoldTimer.current) clearTimeout(traceHoldTimer.current);
    traceHoldTimer.current = null;
    setTracingHold(false);
  }

  function handleTraceActive(active: boolean) {
    if (traceHoldTimer.current) clearTimeout(traceHoldTimer.current);
    traceHoldTimer.current = null;
    if (active) {
      setTracingHold(true);
      return;
    }
    traceHoldTimer.current = setTimeout(() => {
      traceHoldTimer.current = null;
      setTracingHold(false);
    }, TRACE_HOLD_RELEASE_MS);
  }

  // Losing the tab mid-flight (a sibling grabbing the tablet, a phone
  // call) pauses the game rather than letting the mission clock — and
  // the letter the child was looking at — run on unseen.
  useEffect(() => {
    if (phase !== 'flying') return;
    function onVisibility() {
      if (document.hidden) setPauseOpen(true);
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  // The name flight's payoff: on landing, spell the name out loud — with
  // letter NAMES, the way a name is spelled ("M… I… A…"), then the name
  // itself — while the end screen pops each letter in (see flight-end-name).
  useEffect(() => {
    if (phase !== 'end' || mode !== 'name' || endReason !== 'collected' || !profile) return;
    let cancelled = false;
    void (async () => {
      await new Promise((r) => setTimeout(r, 900));
      for (const q of nameQueue) {
        if (cancelled) return;
        await speak(q.canonicalLetter);
        await new Promise((r) => setTimeout(r, 220));
      }
      if (!cancelled) await speak(profile.name);
    })();
    return () => {
      cancelled = true;
    };
    // Once per landing — phase flips to 'end' exactly once per flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Duck the wind/sea bed while a letter is being spoken over it.
  useEffect(() => {
    sfx.setAmbientLevel(activeLetter || pauseOpen ? 0.3 : 1);
  }, [activeLetter, pauseOpen]);

  function showToast(text: string, kind: 'star' | 'bonus' | 'gentle', ms = 1300) {
    setToast({ text, kind });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), ms);
  }

  function recordOutcome(letter: string, outcome: Outcome) {
    outcomesRef.current.set(letter, outcome);
    if (isPlannedMode(mode)) setSlotOutcomes((prev) => ({ ...prev, [planIndex]: outcome }));
  }

  /** Every genuine miss (self-reported "didn't know", or flew past never even tapped) bumps this letter's in-flight miss streak. */
  function recordLetterMiss(letter: string) {
    missStreakRef.current.set(letter, (missStreakRef.current.get(letter) ?? 0) + 1);
  }
  /** Any correct resolution, via any path, clears it — the struggle was this flight's, not a permanent label on the letter. */
  function clearLetterMiss(letter: string) {
    missStreakRef.current.delete(letter);
  }

  /**
   * Call after any correct catch — see STREAK_MILESTONE's doc comment
   * above. Reads `streak` from the closure rather than using setState's
   * functional-updater form: registerStreak is only ever called once per
   * tick from an event handler (never from inside a render), so there's
   * no stale-closure risk here, and it keeps awardStars/showToast (real
   * side effects, including another component's dispatch) out of the
   * updater function — React can invoke that function during render
   * (e.g. to resolve batched updates), and side effects in there produce
   * exactly the "Cannot update a component while rendering a different
   * component" warning this shipped with once, caught via the browser
   * console during a Playwright playthrough, not by inspection.
   */
  function registerStreak() {
    const next = streak + 1;
    setStreak(next);
    if (next % STREAK_MILESTONE === 0) {
      awardStars(STREAK_BONUS_STARS);
      sfx.play('bonus');
      sfx.haptic([10, 30, 10, 30, 18]);
      showToast(`${next} in a row! +${STREAK_BONUS_STARS} bonus star`, 'bonus', 1600);
    }
    if (next % RAINBOW_STREAK === 0 && Math.random() < RAINBOW_CHANCE) rainbowDueRef.current = true;
  }

  /** Call after any miss (self-reported, a wrong picture pick, or a letter flown past unanswered) — quietly resets, no extra toast/sound of its own so a miss never stacks two "you got it wrong" beats. */
  function breakStreak() {
    setStreak(0);
  }

  /**
   * Shows the classic, traceable letter-cloud directly for `item` — no
   * lottery, no chance of it becoming a mini-game instead. This is the
   * ONE place a cloud actually spawns; presentItem's own fallback below
   * calls it, and so does resumeAfterSpecialRound once a bonus round
   * finishes, which is what guarantees every letter always gets its
   * real cloud turn — see presentItem's doc comment.
   */
  function presentClassicCloud(item: QueueItem, distance: number) {
    setEncounter(spawnEncounter(item, distance));
  }

  /**
   * The single place every queue item gets presented, so the
   * PLANE_ROUND_EVERY/CVC_ROUND_EVERY/LETTER_MATCHUP_CHANCE cadences
   * live in one spot instead of being duplicated at each of the 4 call
   * sites that used to spawn a cloud directly (classic/endless first
   * spawn in handleTakeOff, classic/endless next spawn in
   * advanceAfterEncounter).
   *
   * A mini-game round is a BONUS INTERLUDE in front of a letter's turn,
   * never a replacement for it — every branch that opens one stashes
   * the item in pendingPresentRef first, and resumeAfterSpecialRound
   * (called once that round resolves) hands it straight to
   * presentClassicCloud, bypassing this function's own lottery entirely
   * so a letter that already got diverted into one bonus round can't
   * roll into a second one before its real cloud ever shows. Every
   * letter in the queue is guaranteed to appear as a traceable cloud
   * eventually — tap/trace/type/say/picture-choice all stay available
   * on it exactly as before; a mini-game just sometimes runs first.
   */
  function presentItem(item: QueueItem, distance: number) {
    // The name flight is a spelling: nothing interrupts it — each letter
    // of the name straight after the last, as its own cloud.
    if (mode === 'name') {
      presentClassicCloud(item, distance);
      return;
    }
    // The streak reward jumps the queue — it was earned, so it shouldn't
    // wait behind a CVC/matchup/plane roll. It still takes this letter's
    // one bonus slot, so the usual "at most one interlude, then the
    // cloud" rule holds.
    if (rainbowDueRef.current) {
      rainbowDueRef.current = false;
      pendingPresentRef.current = { item, distance };
      setEncounter(null);
      setWrongRainbowOption(null);
      setRainbowRound(buildRainbowRound(item.canonicalLetter));
      // Spoken as well as shown in the banner — a pre-reader can't read it.
      void speak(RAINBOW_PROMPT);
      return;
    }
    roundsUntilCvcRef.current -= 1;
    if (roundsUntilCvcRef.current <= 0) {
      roundsUntilCvcRef.current = CVC_ROUND_EVERY;
      if (Math.random() < VOWEL_STORM_SHARE) {
        openVowelStorm(buildVowelRound(), item, distance);
        return;
      }
      pendingPresentRef.current = { item, distance };
      setEncounter(null);
      setWrongCvcIndex(null);
      const word = randomCvcWord();
      setCvcRound({ id: word.id, letters: word.letters, nextIndex: 0 });
      return;
    }
    if (state.settings.lookAlikePractice) {
      const partners = confusablePartnersFor(item.canonicalLetter);
      if (partners.length > 0 && Math.random() < LETTER_MATCHUP_CHANCE) {
        const partner = partners[Math.floor(Math.random() * partners.length)];
        const target = item.canonicalLetter.toLowerCase();
        const options: [string, string] = Math.random() < 0.5 ? [target, partner] : [partner, target];
        pendingPresentRef.current = { item, distance };
        setEncounter(null);
        setWrongMatchupOption(null);
        setLetterMatchup({ target: item.canonicalLetter, options });
        return;
      }
    }
    if (stormDueRef.current || Math.random() < STORM_CHANCE) {
      const round = buildOddSoundRound(item.canonicalLetter);
      if (round) {
        stormDueRef.current = false;
        openStorm(round, item, distance);
        return;
      }
    }
    roundsUntilPlaneRef.current -= 1;
    if (roundsUntilPlaneRef.current <= 0) {
      roundsUntilPlaneRef.current = PLANE_ROUND_EVERY;
      pendingPresentRef.current = { item, distance };
      setEncounter(null);
      setWrongPlaneOption(null);
      setPlaneChallenge(buildPlaneChoiceRound(item.canonicalLetter, item.displayChar));
      return;
    }
    presentClassicCloud(item, distance);
  }

  async function handleTakeOff() {
    sfx.unlock();
    sfx.play('takeoff');
    // Must be inside the tap (iOS shows its permission sheet only from a
    // gesture) and before the first await. Not awaited: a slow sheet
    // must never hold up the take-off itself.
    recenterTilt();
    void requestTiltPermission();
    await preloadFonts();
    nextSpawnDistanceRef.current = SPAWN_DISTANCE_AHEAD;
    practicedRef.current = new Set();
    outcomesRef.current = new Map();
    missStreakRef.current = new Map();
    correctCountRef.current = 0;
    totalCountRef.current = 0;
    sessionStartedAtRef.current = new Date().toISOString();
    starsAtStartRef.current = state.starsTotal;
    masteredAtStartRef.current = new Set(Object.values(state.letters).filter((l) => l.box >= 4).map((l) => l.letter));
    setFoundCount(0);
    setCorrectTick(0);
    setSprintTimeAdjust(0);
    setSlotOutcomes({});
    setStreak(0);
    setPlaneChallenge(null);
    setWrongPlaneOption(null);
    setLetterMatchup(null);
    setWrongMatchupOption(null);
    setCvcRound(null);
    setWrongCvcIndex(null);
    setRainbowRound(null);
    setWrongRainbowOption(null);
    rainbowDueRef.current = false;
    setStormRound(null);
    stormDueRef.current = false;
    setVowelRound(null);
    sfx.stopRain();
    pendingPresentRef.current = null;
    roundsUntilPlaneRef.current = PLANE_ROUND_EVERY;
    roundsUntilCvcRef.current = CVC_ROUND_EVERY;
    setPauseOpen(false);
    setWriting(null);
    pendingAdvanceRef.current = null;
    traceCompletionsRef.current = 0;
    lastTraceRef.current = null;
    releaseTracingHold();
    setToast(null);
    if (mode === 'endless' || mode === 'sprint') {
      setMissionPlan([]);
      setPlanIndex(0);
      presentItem(pickEndlessItem(state.letters, profile?.readingLevel, focusLetters), SPAWN_DISTANCE_AHEAD);
    } else {
      const plan = mode === 'name' ? nameQueue : buildMissionQueue(state.letters, MISSION_LENGTH, profile?.readingLevel, focusLetters);
      setMissionPlan(plan);
      setPlanIndex(0);
      if (plan.length > 0) presentItem(plan[0], SPAWN_DISTANCE_AHEAD);
      else setEncounter(null);
    }
    setPhase('flying');
    sfx.startAmbient();
  }

  function finishMission(reason: EndReason) {
    sfx.stopRain();
    if (sessionStartedAtRef.current) {
      logSession({
        date: new Date().toISOString().slice(0, 10),
        startedAt: sessionStartedAtRef.current,
        endedAt: new Date().toISOString(),
        lettersPracticed: Array.from(practicedRef.current),
        correctCount: correctCountRef.current,
        totalCount: totalCountRef.current,
      });
      sessionStartedAtRef.current = null;
    }
    sfx.stopAmbient();
    sfx.play('land');
    setEndReason(reason);
    setEncounter(null);
    setActiveLetter(null);
    setPauseOpen(false);
    setWriting(null);
    pendingAdvanceRef.current = null;
    setPhase('end');
  }

  function handleTapLetter(canonicalLetter: string) {
    sfx.play('tap');
    setActiveLetter(canonicalLetter);
    setEncounter((prev) => (prev && prev.canonicalLetter === canonicalLetter ? { ...prev, status: 'active' } : prev));
    sayLetterAloud(canonicalLetter);
  }

  function handleReplay() {
    sfx.play('tap');
    if (activeLetter) sayLetterAloud(activeLetter);
  }

  function handleAnswer(knewIt: boolean) {
    if (!activeLetter) return;
    answer(activeLetter, knewIt);
    practicedRef.current.add(activeLetter);
    totalCountRef.current += 1;
    if (knewIt) {
      correctCountRef.current += 1;
      recordOutcome(activeLetter, 'knew');
      if (mode === 'endless') setCorrectTick((n) => n + 1);
      sfx.play('correct');
      sfx.haptic(14);
      showToast('+1 star', 'star');
      registerStreak();
      clearLetterMiss(activeLetter);
    } else {
      recordOutcome(activeLetter, 'missed');
      sfx.play('miss');
      breakStreak();
      recordLetterMiss(activeLetter);
      if (mode === 'sprint') {
        setSprintTimeAdjust((n) => n + SPRINT_MISTAKE_SECONDS);
        // Not a harsh/red "wrong" state — just an honest heads-up that
        // this mode's whole hook (mistakes cost daylight) just applied.
        showToast('The sun sets a little faster…', 'gentle', 1500);
      } else {
        showToast(`That's ${activeLetter} — you'll meet it again soon`, 'gentle', 1700);
      }
    }
    setEncounter((prev) => (prev && prev.canonicalLetter === activeLetter ? { ...prev, status: 'answered', knew: knewIt } : prev));
    setActiveLetter(null);
  }

  // A fresh set of 3 candidate pictures per encounter (not per render) —
  // only regenerated when the letter itself changes, so they don't
  // reshuffle out from under a child mid-decision while the same
  // encounter is still pending/active/resolving.
  const encounterLetter = encounter?.canonicalLetter ?? null;
  useEffect(() => {
    const choices = encounterLetter ? buildPictureChoices(encounterLetter) : null;
    setPictureChoices(choices);
    setSolvedPickId(null);
    if (choices) {
      preloadFlashCardTextures(choices.map((c) => c.word.id));
    }
  }, [encounterLetter]);

  /**
   * Shared "correct, bonus-worthy" resolution for both fast paths past
   * the tap + self-report loop — typing the letter on a keyboard, and
   * picking the right picture. Either one IS the proof of knowledge, so
   * it skips straight to a bigger reward and the cloud's bubble-burst
   * celebration (LetterCloud's `burst` mode) instead of the plain fade
   * used when the bird simply flies past an unanswered cloud.
   */
  function awardBonusSolve(letter: string, toastText: string, { glowMs = 0 }: { glowMs?: number } = {}) {
    answer(letter, true);
    awardStars(TYPE_BONUS_STARS);
    practicedRef.current.add(letter);
    totalCountRef.current += 1;
    correctCountRef.current += 1;
    recordOutcome(letter, 'bonus');
    clearLetterMiss(letter);
    if (mode === 'endless') setCorrectTick((n) => n + 1);
    if (mode === 'sprint') setSprintTimeAdjust((n) => n + SPRINT_BONUS_SECONDS);
    sfx.play('bonus');
    sfx.haptic([10, 40, 18]);
    sayLetterAloud(letter);
    setActiveLetter(null);

    const pop = () => {
      sfx.play('pop');
      setEncounter((prev) => (prev && prev.canonicalLetter === letter && prev.status !== 'typed' ? { ...prev, status: 'typed' } : prev));
      showToast(toastText, 'bonus', 1500);
      // After the solve's own toast, not before — a milestone toast
      // fired earlier (registerStreak is synchronous) would just get
      // clobbered by this one a beat later on the glow-then-pop path
      // (trace), since showToast always replaces whatever's showing.
      registerStreak();
    };
    if (glowMs <= 0) {
      pop();
      return;
    }
    // Glow first (the whole cloud and the ribbon light up), then pop.
    setEncounter((prev) => (prev && prev.canonicalLetter === letter ? { ...prev, status: 'glowing' } : prev));
    if (traceGlowTimer.current) clearTimeout(traceGlowTimer.current);
    traceGlowTimer.current = setTimeout(() => {
      traceGlowTimer.current = null;
      pop();
    }, glowMs);
  }

  const encounterRef = useRef(encounter);
  encounterRef.current = encounter;

  function handleTypeLetter(typedKey: string) {
    const enc = encounterRef.current;
    if (!enc) return;
    if (enc.status !== 'pending' && enc.status !== 'active') return;
    if (typedKey.toUpperCase() !== enc.canonicalLetter) return;
    awardBonusSolve(enc.canonicalLetter, `Typed it! +${1 + TYPE_BONUS_STARS} stars`);
  }

  // SpeechLetterButton already confirmed the transcript matches this
  // specific encounter's letter (matchesLetterName) before calling this
  // — same guard shape as handleTypeLetter otherwise, so a stale result
  // arriving after the encounter's already resolved can't double-award.
  function handleSpeechMatch() {
    if (!encounter) return;
    if (encounter.status !== 'pending' && encounter.status !== 'active') return;
    awardBonusSolve(encounter.canonicalLetter, `Said it! +${1 + TYPE_BONUS_STARS} stars`);
  }

  function handleHandwritingMatch() {
    setHandwritingOpen(false);
    if (!encounter) return;
    if (encounter.status !== 'pending' && encounter.status !== 'active') return;
    awardBonusSolve(encounter.canonicalLetter, `Wrote it! +${1 + TYPE_BONUS_STARS} stars`);
  }

  function handleTraceComplete(canonicalLetter: string) {
    const enc = encounterRef.current;
    if (!enc || enc.canonicalLetter !== canonicalLetter) return;
    if (enc.status !== 'pending' && enc.status !== 'active') return;
    traceCompletionsRef.current += 1;
    lastTraceRef.current = { canonical: canonicalLetter, display: enc.displayChar };
    awardBonusSolve(canonicalLetter, `Traced it! +${1 + TYPE_BONUS_STARS} stars`, { glowMs: TRACE_GLOW_MS });
  }

  /** True when the letter that just resolved was traced AND it's the Nth trace — time for the lined page. */
  function writingDueFor(canonicalLetter: string): boolean {
    if (state.settings.writingPractice === 'off') return false;
    const last = lastTraceRef.current;
    if (!last || last.canonical !== canonicalLetter) return false;
    return traceCompletionsRef.current > 0 && traceCompletionsRef.current % WRITING_EVERY_N_TRACES === 0;
  }

  function closeWriting(completed: boolean) {
    setWriting(null);
    if (completed) {
      awardStars(WRITING_STARS);
      sfx.haptic([10, 40, 18]);
      showToast(`Beautiful writing! +${WRITING_STARS} stars`, 'bonus', 1600);
    }
    const advance = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    advance?.();
  }

  function handlePicturePick(choice: PictureChoiceEntry) {
    if (!encounter || encounter.status !== 'pending') return;
    if (solvedPickId) return;
    if (!choice.isTarget) {
      sfx.play('miss');
      setWrongPickId(choice.word.id);
      setTimeout(() => setWrongPickId(null), 400);
      breakStreak();
      return;
    }
    setSolvedPickId(choice.word.id);
    speak(choice.word.word);
    const REVEAL_MS = 1400;
    awardBonusSolve(
      encounter.canonicalLetter,
      `${choice.word.word}! Starts with ${encounter.canonicalLetter} +${1 + TYPE_BONUS_STARS} stars`,
      { glowMs: REVEAL_MS }
    );
    setTimeout(() => {
      setSolvedPickId(null);
    }, REVEAL_MS + 200);
  }

  // Speaks the round's target letter once when it starts — this IS the
  // prompt (there's no glyph on screen to read, unlike every other
  // path), so it can't be an optional nice-to-have the way handleReplay
  // is elsewhere. Keyed on the planeChallenge object itself, which is a
  // fresh reference each time a new round starts and null in between, so
  // this fires exactly once per round and never on an unrelated re-render.
  useEffect(() => {
    // letterVoice can't change mid-round (it's set from the dashboard, which ends the flight), so this still fires once per round.
    if (planeChallenge) void sayLetter(planeChallenge.letter, letterVoice);
  }, [planeChallenge, letterVoice]);

  function handlePlanePick(option: string) {
    if (!planeChallenge) return;
    if (option !== planeChallenge.target) {
      sfx.play('miss');
      setWrongPlaneOption(option);
      setTimeout(() => setWrongPlaneOption(null), 400);
      breakStreak();
      return;
    }
    // awardBonusSolve's other side effects (setEncounter, setActiveLetter)
    // are harmless no-ops here — `encounter` and `activeLetter` are both
    // already null throughout a plane round — so it's safe to reuse
    // wholesale rather than duplicating the scoring/streak/mastery wiring.
    awardBonusSolve(planeChallenge.letter, `Found the ${planeChallenge.letter} plane! +${1 + TYPE_BONUS_STARS} stars`);
    // A short beat so the win toast/sfx register before the planes and
    // prompt vanish and normal flight resumes — same idea as the cloud
    // path's TRACE_GLOW_MS pause, just simpler (no glow state to drive).
    setTimeout(() => {
      setPlaneChallenge(null);
      resumeAfterSpecialRound();
    }, 700);
  }

  // Same reasoning as the planeChallenge effect above — the spoken
  // letter name IS the prompt for a matchup round too.
  useEffect(() => {
    if (letterMatchup) void sayLetter(letterMatchup.target, letterVoice);
  }, [letterMatchup, letterVoice]);

  function handleMatchupPick(option: string) {
    if (!letterMatchup) return;
    if (option !== letterMatchup.target.toLowerCase()) {
      sfx.play('miss');
      setWrongMatchupOption(option);
      setTimeout(() => setWrongMatchupOption(null), 400);
      breakStreak();
      return;
    }
    // Same "harmless no-op" reasoning as handlePlanePick above.
    awardBonusSolve(letterMatchup.target, `That's ${letterMatchup.target}! +${1 + TYPE_BONUS_STARS} stars`);
    setTimeout(() => {
      setLetterMatchup(null);
      resumeAfterSpecialRound();
    }, 700);
  }

  /**
   * Tapping out of order isn't "not knowing a letter" — it's a
   * sequencing slip in an ordering puzzle, so unlike every other miss
   * path in this file it deliberately does NOT call breakStreak() or
   * recordLetterMiss(): a child who taps T before C on their first try
   * hasn't demonstrated they don't know either letter, and shouldn't
   * lose a streak or get flagged as struggling on one over it.
   */
  function handleCvcSlotTap(index: number) {
    if (!cvcRound) return;
    if (index !== cvcRound.nextIndex) {
      sfx.play('miss');
      setWrongCvcIndex(index);
      setTimeout(() => setWrongCvcIndex(null), 400);
      return;
    }
    sfx.play('pop');
    const letterSaid = blendLetter(cvcRound.letters[index]);
    practicedRef.current.add(cvcRound.letters[index]);
    const nextIndex = index + 1;
    // Advance state immediately, before even checking completion — this
    // is what stops a tap landing during the post-completion pause below
    // from being read as ANOTHER correct tap on the same final slot and
    // re-awarding the whole word's bonus a second time (cvcRound itself
    // isn't cleared until CVC_WORD_PAUSE_MS later, on purpose, so the
    // locked-gold letters stay visible during the celebration — but
    // nextIndex moving past the last letter means no valid index can
    // ever equal it again, so a stray extra tap now falls into the
    // "wrong index" shake branch above instead of completing twice).
    setCvcRound((prev) => (prev ? { ...prev, nextIndex } : prev));
    if (nextIndex >= cvcRound.letters.length) {
      const word = cvcRound.letters.join('');
      awardStars(CVC_BONUS_STARS);
      registerStreak();
      sfx.play('bonus');
      sfx.haptic([10, 40, 18]);
      showToast(`You spelled ${word}! +${CVC_BONUS_STARS} stars`, 'bonus', CVC_WORD_PAUSE_MS - 100);
      // A beat after the last letter's own sound finishes (chained, not
      // a fixed timer — a stretched "ssss" runs longer than a "tuh"), then
      // the whole blended word. Hearing both is the actual point.
      void letterSaid.then(() => new Promise((r) => setTimeout(r, 200))).then(() => speak(word));
      setTimeout(() => {
        setCvcRound(null);
        resumeAfterSpecialRound();
      }, CVC_WORD_PAUSE_MS);
    }
  }

  /**
   * A reward round, not a test of a letter: a wrong pick just shakes the
   * swatch (no breakStreak, no recordLetterMiss — colours aren't what
   * this child is being assessed on), and a right one awards stars
   * without touching letter mastery or the streak (which would let a
   * rainbow feed the very streak that summons the next one).
   */
  function handleRainbowPick(id: RainbowColor['id']) {
    if (!rainbowRound || rainbowRound.solved) return;
    const target = RAINBOW_COLORS[rainbowRound.glowIndex];
    if (id !== target.id) {
      sfx.play('miss');
      setWrongRainbowOption(id);
      setTimeout(() => setWrongRainbowOption(null), 400);
      return;
    }
    setRainbowRound((prev) => (prev ? { ...prev, solved: true } : prev));
    awardStars(RAINBOW_BONUS_STARS);
    sfx.play('bonus');
    sfx.haptic([10, 40, 18]);
    const letter = target.word[0];
    const matchesNext = pendingPresentRef.current?.item.canonicalLetter === letter;
    showToast(
      matchesNext ? `${target.word}! ${letter} is for ${target.word} +${RAINBOW_BONUS_STARS} stars` : `${target.word}! +${RAINBOW_BONUS_STARS} stars`,
      'bonus',
      RAINBOW_WIN_PAUSE_MS - 100,
    );
    void speak(target.word).then(() => {
      // Only when it's the letter about to appear as a cloud — then the
      // colour doubles as a preview of it.
      if (matchesNext) void sayLetterAloud(letter);
    });
    // No timer ending the round: `solved` sends the bird dashing through
    // the arch (FlightScene's RAINBOW_DASH_FACTOR), and flying under it
    // is what ends the round — see handleRainbowPassed.
    setTimeout(() => sfx.play('whoosh'), 450);
  }

  /**
   * The rainbow doesn't freeze the flight (it slows it, then dashes — see
   * FlightScene's RAINBOW_SPEED_FACTOR / RAINBOW_DASH_FACTOR), so the
   * distance stashed in pendingPresentRef when it opened is now behind
   * the bird: re-anchor the held letter's cloud to where the bird
   * actually is before resuming. Safe to call twice — the second call
   * finds nothing pending.
   */
  function endRainbowRound() {
    const pending = pendingPresentRef.current;
    setRainbowRound(null);
    if (!pending) return;
    pendingPresentRef.current = { ...pending, distance: birdDistanceRef.current + SPAWN_DISTANCE_AHEAD };
    resumeAfterSpecialRound();
  }

  /**
   * Flew under the arch — the one way a rainbow round ends. After a
   * right answer that's the payoff of the dash; unanswered, it just
   * quietly ends (no reward, no penalty — it was a bonus).
   */
  function handleRainbowPassed() {
    if (!rainbowRound) return;
    if (rainbowRound.solved) sfx.play('whoosh');
    endRainbowRound();
  }

  function openStorm(round: OddSoundRound, item: QueueItem, distance: number) {
    pendingPresentRef.current = { item, distance };
    setEncounter(null);
    setActiveLetter(null);
    setStormRound({ ...round, wrongId: null, solved: false, misses: 0, hint: false });
    sfx.startRain();
    void announceStorm(round);
  }

  /**
   * Dev-mode Alt+S (?dev=true): toggles a storm at will. During a storm,
   * clears it. Otherwise opens one right now on the cloud currently in
   * the sky (which then comes back after it, as with any bonus round);
   * for a letter that can't make a fair pair (U, X) it borrows a round
   * from one that can. With no cloud up (another bonus round running) it
   * queues one for the next letter instead.
   */
  function devToggleStorm() {
    if (stormRound) {
      if (stormRound.solved) return;
      stormSpeechRef.current++;
      sfx.stopRain();
      showToast('Storm cleared', 'gentle', 1100);
      endStormRound();
      return;
    }
    const enc = encounterRef.current;
    if (enc && (enc.status === 'pending' || enc.status === 'active')) {
      const round = buildOddSoundRound(enc.canonicalLetter) ?? buildOddSoundRound('B');
      if (round) {
        openStorm(round, { canonicalLetter: enc.canonicalLetter, displayChar: enc.displayChar }, enc.distance);
        return;
      }
    }
    stormDueRef.current = true;
    showToast('Storm coming up next', 'gentle', 1300);
  }
  const devToggleStormRef = useRef(devToggleStorm);
  devToggleStormRef.current = devToggleStorm;

  function openVowelStorm(round: VowelRound, item: QueueItem, distance: number) {
    pendingPresentRef.current = { item, distance };
    setEncounter(null);
    setActiveLetter(null);
    setVowelRound({ ...round, solved: false, wrong: null, hint: false });
    vowelMissesRef.current = 0;
    sfx.startRain();
    void announceVowel(round);
  }
  const vowelMissesRef = useRef(0);

  /** Says the whole word, then asks — the child hears "cat" and finds the sound that's missing from C _ T. */
  async function announceVowel(round: VowelRound) {
    const mine = ++vowelSpeechRef.current;
    await speak(round.id);
    if (vowelSpeechRef.current !== mine) return;
    await new Promise((r) => setTimeout(r, 300));
    if (vowelSpeechRef.current !== mine) return;
    await speak(VOWEL_PROMPT);
  }

  /**
   * A wrong drop: its sound, then "listen: cat" again — no streak
   * penalty; after VOWEL_HINT_AFTER misses the right drop glows. The
   * right drop: it drops into the gap, lightning strikes the word, and
   * the word is blended sound by sound, then said whole.
   */
  async function handleVowelPick(v: string) {
    const round = vowelRound;
    if (!round || round.solved) return;
    const mine = ++vowelSpeechRef.current;
    if (v !== round.vowel) {
      sfx.play('miss');
      vowelMissesRef.current += 1;
      const hint = vowelMissesRef.current >= VOWEL_HINT_AFTER;
      setVowelRound((prev) => (prev ? { ...prev, wrong: v, hint } : prev));
      setTimeout(() => setVowelRound((prev) => (prev && prev.wrong === v ? { ...prev, wrong: null } : prev)), 450);
      await speakLetterSound(v);
      if (vowelSpeechRef.current !== mine) return;
      await speak(`Listen: ${round.id}`);
      return;
    }
    setVowelRound((prev) => (prev ? { ...prev, solved: true, wrong: null, hint: false } : prev));
    setStrikeKey((k) => k + 1);
    sfx.stopRain();
    awardStars(VOWEL_BONUS_STARS);
    registerStreak();
    sfx.play('bonus');
    sfx.haptic([10, 40, 18]);
    const word = round.letters.join('');
    showToast(`${word}! +${VOWEL_BONUS_STARS} stars`, 'bonus', VOWEL_CLEAR_MS - 300);
    setTimeout(endVowelStorm, VOWEL_CLEAR_MS);
    await new Promise((r) => setTimeout(r, 500)); // let the thunder land first
    for (const letter of round.letters) {
      if (vowelSpeechRef.current !== mine) return;
      await blendLetter(letter);
      await new Promise((r) => setTimeout(r, 120));
    }
    if (vowelSpeechRef.current !== mine) return;
    await speak(round.id);
  }

  /** Same re-anchoring as the other storm: the flight kept moving. */
  function endVowelStorm() {
    const pending = pendingPresentRef.current;
    setVowelRound(null);
    if (!pending) return;
    pendingPresentRef.current = { ...pending, distance: birdDistanceRef.current + SPAWN_DISTANCE_AHEAD };
    resumeAfterSpecialRound();
  }

  /** Dev-mode Alt+V (?dev=true): toggles a Storm Vowels round — opens one now on the cloud in the sky, or clears the current one. */
  function devToggleVowelStorm() {
    if (vowelRound) {
      if (vowelRound.solved) return;
      vowelSpeechRef.current++;
      sfx.stopRain();
      showToast('Storm cleared', 'gentle', 1100);
      endVowelStorm();
      return;
    }
    const enc = encounterRef.current;
    if (enc && (enc.status === 'pending' || enc.status === 'active') && !stormRound) {
      openVowelStorm(buildVowelRound(), { canonicalLetter: enc.canonicalLetter, displayChar: enc.displayChar }, enc.distance);
      return;
    }
    showToast('Wait for a letter cloud, then press again', 'gentle', 1500);
  }
  const devToggleVowelStormRef = useRef(devToggleVowelStorm);
  devToggleVowelStormRef.current = devToggleVowelStorm;

  /**
   * Reads the storm's three cards aloud, then asks the question — this is
   * a LISTENING task, and most players can't read yet. Cancelled
   * part-way by a tap (the child already answering) or a replay.
   */
  async function announceStorm(round: OddSoundRound) {
    const mine = ++stormSpeechRef.current;
    for (const id of round.cardIds) {
      await speak(cardWord(id));
      if (stormSpeechRef.current !== mine) return;
      await new Promise((r) => setTimeout(r, 250));
      if (stormSpeechRef.current !== mine) return;
    }
    await speak(STORM_PROMPT);
  }

  /**
   * A wrong pick isn't punished (no breakStreak — it's a sound game, not
   * a letter the child failed): the card shakes and the game explains,
   * "Ball and Bear both start with /b/". After STORM_HINT_AFTER misses
   * the odd card glows. The right pick clears the storm.
   */
  async function handleStormPick(id: string) {
    const round = stormRound;
    if (!round || round.solved) return;
    const mine = ++stormSpeechRef.current;
    if (id !== round.oddId) {
      sfx.play('miss');
      const misses = round.misses + 1;
      setStormRound((prev) => (prev ? { ...prev, wrongId: id, misses, hint: misses >= STORM_HINT_AFTER } : prev));
      setTimeout(() => setStormRound((prev) => (prev && prev.wrongId === id ? { ...prev, wrongId: null } : prev)), 400);
      const partner = round.cardIds.find((c) => c !== id && c !== round.oddId) ?? id;
      await speak(`${cardWord(id)} and ${cardWord(partner)} both start with`);
      if (stormSpeechRef.current !== mine) return;
      await speakLetterSound(letterForSound(round.pairSound));
      return;
    }
    setStormRound((prev) => (prev ? { ...prev, solved: true, wrongId: null, hint: false } : prev));
    sfx.stopRain();
    awardStars(STORM_BONUS_STARS);
    sfx.play('bonus');
    sfx.haptic([10, 40, 18]);
    const oddWord = cardWord(round.oddId);
    showToast(`${oddWord} starts with a different sound! +${STORM_BONUS_STARS} stars`, 'bonus', STORM_CLEAR_MS - 200);
    setTimeout(endStormRound, STORM_CLEAR_MS);
    await speak(oddWord);
    if (stormSpeechRef.current !== mine) return;
    await speakLetterSound(letterForSound(round.oddSound));
  }

  /** Same re-anchoring as endRainbowRound: the flight kept moving through the storm. */
  function endStormRound() {
    const pending = pendingPresentRef.current;
    setStormRound(null);
    if (!pending) return;
    pendingPresentRef.current = { ...pending, distance: birdDistanceRef.current + SPAWN_DISTANCE_AHEAD };
    resumeAfterSpecialRound();
  }

  const handleTypeLetterRef = useRef(handleTypeLetter);
  handleTypeLetterRef.current = handleTypeLetter;

  useEffect(() => {
    if (phase !== 'flying') return;
    function onKeyDown(e: KeyboardEvent) {
      // Matched on `code`: on macOS, Option+R produces "®" as the key.
      if (DEV_SHORTCUTS && e.altKey && e.code === 'KeyR' && !e.repeat) {
        e.preventDefault();
        rainbowDueRef.current = true;
        showToast('Rainbow coming up next', 'gentle', 1300);
        return;
      }
      if (DEV_SHORTCUTS && e.altKey && e.code === 'KeyS' && !e.repeat) {
        e.preventDefault();
        devToggleStormRef.current();
        return;
      }
      if (DEV_SHORTCUTS && e.altKey && e.code === 'KeyV' && !e.repeat) {
        e.preventDefault();
        devToggleVowelStormRef.current();
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      // Backtick toggles the dev-only ocean/sky tuning panel (DevOceanPanel)
      // — never shown to a player, only reachable by someone who knows to
      // press it. Matched on `code` (the physical key, "Backquote" — same key
      // regardless of layout) rather than only `key` (the character it
      // produces, which some non-US layouts remap or gate behind a
      // modifier), so this isn't silently US-keyboard-only.
      if (e.key === '`' || e.code === 'Backquote') {
        setDevPanelOpen((open) => !open);
        return;
      }
      if (e.key === 'Escape') {
        setPauseOpen((open) => !open);
        return;
      }
      // Spacebar is a shortcut straight into the same "say the letter"
      // flow as tapping the mic button — matched on `code` for the same
      // layout-independence reason as backtick above. Prevent default
      // first: an unprevented space scrolls the page and, worse, "clicks"
      // whatever button currently has focus (e.g. a just-tapped HUD
      // button), which would double-fire an action.
      if (e.code === 'Space') {
        e.preventDefault();
        speechButtonRef.current?.trigger();
        return;
      }
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      handleTypeLetterRef.current(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase]);

  function handlePassed(canonicalLetter: string) {
    sfx.play('whoosh');
    // FlightScene also fires this for an already-'answered' encounter
    // (right OR wrong) once its cloud finishes drifting past — it's the
    // generic "the cloud is behind us now" cleanup, not proof this one
    // went unanswered. Only a still-'pending' encounter (the child never
    // even tapped it) is a genuine unanswered miss; breaking the streak
    // on every pass would otherwise wipe out the very streak a correct
    // "knew it" answer just built, the instant that cloud drifts away.
    if (encounterRef.current?.canonicalLetter === canonicalLetter && encounterRef.current.status === 'pending') {
      breakStreak();
      recordLetterMiss(canonicalLetter);
    }
    setEncounter((prev) => (prev && prev.canonicalLetter === canonicalLetter && prev.status !== 'active' ? { ...prev, status: 'passed' } : prev));
  }

  function handleHoverCaseSwap(canonicalLetter: string) {
    // Never swap the glyph out from under a half-drawn trace (see
    // LetterTracer's traceActivity).
    if (isTraceInProgress()) return;
    setEncounter((prev) => {
      if (!prev || prev.canonicalLetter !== canonicalLetter || prev.status !== 'pending') return prev;
      const isUpper = prev.displayChar === prev.canonicalLetter;
      return { ...prev, displayChar: isUpper ? prev.canonicalLetter.toLowerCase() : prev.canonicalLetter };
    });
  }

  function handleFadeComplete(canonicalLetter: string, birdDistance: number) {
    setEncounter((prev) => (prev && prev.canonicalLetter === canonicalLetter ? null : prev));
    // The letter is gone — nothing left to hold still for.
    releaseTracingHold();
    if (writingDueFor(canonicalLetter)) {
      // Hold the flight (empty sky, no clock) while the lined page is up;
      // the next cloud spawns only once the page closes.
      const display = lastTraceRef.current?.display ?? canonicalLetter;
      lastTraceRef.current = null;
      pendingAdvanceRef.current = () => advanceAfterEncounter(birdDistance);
      setWriting({ letter: display });
      return;
    }
    advanceAfterEncounter(birdDistance);
  }

  function advanceAfterEncounter(birdDistance: number) {
    // Anchored to the bird's actual position right now, not the previous
    // encounter's own spawn distance — see SPAWN_DISTANCE_AHEAD's doc
    // comment for why accumulating from history drifted.
    nextSpawnDistanceRef.current = birdDistance + SPAWN_DISTANCE_AHEAD;
    if (mode === 'endless' || mode === 'sprint') {
      // No fixed round length — always spawn the next one. The session
      // only ends when the night clock catches up (handleMissionTimeUp).
      setFoundCount((n) => n + 1);
      presentItem(pickEndlessItem(state.letters, profile?.readingLevel, focusLetters), nextSpawnDistanceRef.current);
      return;
    }
    const nextIndex = planIndex + 1;
    if (nextIndex >= missionPlan.length) {
      finishMission('collected');
      return;
    }
    setPlanIndex(nextIndex);
    presentItem(missionPlan[nextIndex], nextSpawnDistanceRef.current);
  }

  /**
   * Called once ANY bonus round (plane-choice, letter-matchup, or CVC
   * word) resolves. Every one of them is a genuine interlude in front
   * of a letter's turn, not a replacement for it — presentItem stashes
   * that letter in pendingPresentRef before opening the round (see its
   * own doc comment) — so this always hands it straight to
   * presentClassicCloud, guaranteeing the real, traceable cloud shows
   * next. Deliberately bypasses presentItem's own lottery here (unlike
   * an earlier version, which re-ran it and let a CVC-deferred letter
   * roll into a SECOND bonus round before ever becoming a cloud): one
   * bonus round per letter turn, at most, then its cloud, always.
   *
   * The flight is frozen for the whole round (see `paused` below), so
   * the bird hasn't moved since `distance` was captured at stash time —
   * reusing it directly, rather than recomputing from `nextSpawnDistanceRef`,
   * is what keeps the resumed cloud's spawn point exactly where it
   * would have been if no round had interrupted it.
   */
  function resumeAfterSpecialRound() {
    const pending = pendingPresentRef.current;
    pendingPresentRef.current = null;
    if (pending) {
      presentClassicCloud(pending.item, pending.distance);
      return;
    }
    // Defensive fallback only — every bonus round always stashes a
    // pending item before it opens, so this should be unreachable; a
    // missing one must still never silently strand the flight with
    // nothing presented.
    advanceAfterEncounter(nextSpawnDistanceRef.current - SPAWN_DISTANCE_AHEAD);
  }

  function handleMissionTimeUp() {
    if (phase !== 'flying') return;
    if (mode === 'endless') finishMission('endless');
    else if (mode === 'sprint') finishMission('sprint');
    else finishMission('time');
  }

  function openDashboardFromPlay() {
    // A grown-up opening the dashboard mid-flight ends the flight
    // honestly — the session is logged with whatever was found, rather
    // than silently vanishing the way a bare navigation would.
    if (phase === 'flying') finishMission('landed');
    onOpenDashboard();
  }

  const soundOn = state.settings.soundEnabled;
  const soundToggle = (
    <button
      type="button"
      className="flight-sound-toggle"
      onClick={() => {
        sfx.unlock();
        setSoundEnabled(!soundOn);
        if (!soundOn) setTimeout(() => sfx.play('tap'), 60);
      }}
      aria-pressed={soundOn}
      aria-label={soundOn ? 'Turn sounds off' : 'Turn sounds on'}
    >
      {soundOn ? <SoundOnIcon size={18} /> : <SoundOffIcon size={18} />}
      <span>{soundOn ? 'Sounds on' : 'Sounds off'}</span>
    </button>
  );

  if (phase === 'intro') {
    const ways = [
      { icon: <HandTapIcon size={20} />, label: 'Tap it' },
      { icon: <TraceIcon size={20} />, label: 'Trace it' },
      ...(touchOnly ? [] : [{ icon: <KeyboardIcon size={20} color="currentColor" />, label: 'Type it' }]),
      { icon: <MicIcon size={20} />, label: 'Say it' },
      { icon: <PictureIcon size={20} />, label: 'Spot it' },
    ];
    return (
      <ScreenTransition transitionKey={phase}>
        <div className="flight-intro sky-stage" onPointerDownCapture={() => music.resume()}>
          <SkyBackdrop />
          <div className="flight-intro-corner">
            <button
              type="button"
              className="flight-grownups-btn"
              onClick={() => {
                const next = !musicMuted;
                music.setMuted(next);
                setMusicMuted(next);
              }}
              aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
            >
              {musicMuted ? <SoundOffIcon size={16} /> : <SoundOnIcon size={16} />}
              <span>{musicMuted ? 'Music off' : 'Music on'}</span>
            </button>
            <div className="flight-about-btn-wrap">
              <button
                type="button"
                className="flight-grownups-btn"
                onClick={() => {
                  sfx.play('tap');
                  handleCreditHoverEnd();
                  setAboutOpen(true);
                }}
                onMouseEnter={handleCreditHoverStart}
                onMouseLeave={handleCreditHoverEnd}
                aria-label="About the albatross"
              >
                <InfoIcon size={16} />
                <span>About</span>
              </button>
              {/* A quiet, mouse-only easter egg — hover (not click, not
                  touch — there's no hover on a touchscreen, which is
                  fine, same reasoning as the desktop-only case-swap
                  reveal in FlightScene) for 2s without moving away. */}
              <AsciiCredit visible={creditHover} />
            </div>
            <HoldButton onComplete={onOpenDashboard} className="flight-grownups-btn" ariaLabel="Grown-ups: hold to open the progress dashboard">
              <GrownUpIcon size={16} />
              <span>Grown-ups</span>
            </HoldButton>
          </div>

          {aboutOpen && (
            <div className="flight-about-overlay" role="dialog" aria-modal="true" aria-label="About the albatross">
              <div className="flight-about-card">
                <button type="button" className="flight-about-close" onClick={() => setAboutOpen(false)} aria-label="Close">
                  <CloseIcon size={16} color="var(--ink-soft, #7a6b5a)" />
                </button>
                <div className="flight-about-body">
                  <div className="flight-about-nest">
                    <NestIllustration size={190} />
                  </div>
                  <div className="flight-about-text">
                    <h2 className="font-display">Why an albatross?</h2>
                    <p>
                      An albatross is one of the greatest travelers in the sky. It can glide for months without ever touching
                      land, crossing whole oceans on wings that barely need to flap — riding the wind, resting on the waves,
                      and always continuing toward home. It never gives up on its journey.
                    </p>
                    <p>
                      Learning your letters is a journey too. Some days the wind is easy, some days it isn't — but just like
                      the albatross, every little flight gets you closer. And the nest is always waiting for you at the end.
                    </p>
                  </div>
                </div>
                <figure className="flight-about-photo">
                  <img
                    src="/art/albatross-photo.jpg"
                    alt="A real wandering albatross resting on the blue sea"
                    width={960}
                    height={640}
                    loading="lazy"
                  />
                  <figcaption>
                    A real wandering albatross — its wings can stretch wider than a grown-up is tall! Photo:{' '}
                    <a
                      href="https://commons.wikimedia.org/wiki/File:Diomedea_exulans_-_SE_Tasmania.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      JJ Harrison
                    </a>
                    , CC BY-SA 3.0
                  </figcaption>
                </figure>
                <a
                  className="flight-about-video"
                  href="https://www.youtube.com/watch?v=toJwBgjCZMI"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ▶ Watch “Wings of the Albatross” (National Geographic) with a grown-up
                </a>
                <button type="button" className="btn btn-primary font-display" onClick={() => setAboutOpen(false)}>
                  Keep flying
                </button>
              </div>
            </div>
          )}
          <div className="flight-intro-content">
            <div className="flight-intro-keyart">
              <KeyArt />
              {profile && (
                <div className="flight-intro-avatar">
                  <AvatarIcon avatar={profile.avatar} size={64} />
                </div>
              )}
            </div>
            <h1 className="flight-intro-title font-display">{profile ? `Ready to fly, ${profile.name}?` : 'Time to Fly Home!'}</h1>
            <p className="flight-intro-sub">Gather the letters hiding in the clouds and carry them home to the nest before the stars come out.</p>
            <ul className="flight-ways" aria-label="Ways to catch a letter">
              {ways.map((w) => (
                <li key={w.label} className="flight-way">
                  <span className="flight-way-icon">{w.icon}</span>
                  <span>{w.label}</span>
                </li>
              ))}
            </ul>
            <div className="flight-intro-card">
              <div className="flight-mode-toggle" role="tablist" aria-label="Flight mode">
                {(Object.keys(MODE_COPY) as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    className={`flight-mode-btn${mode === m ? ' active' : ''}`}
                    disabled={m === 'name' && nameQueue.length === 0}
                    title={m === 'name' && nameQueue.length === 0 ? 'Needs a name spelled with English letters' : undefined}
                    onClick={() => {
                      sfx.unlock();
                      sfx.play('tap');
                      setMode(m);
                    }}
                  >
                    {MODE_COPY[m].label}
                  </button>
                ))}
              </div>
              <p className="flight-mode-desc">
                {mode === 'name' ? `Fly the letters of ${profile?.name ?? 'your name'} — and watch your name spell itself in the sky!` : MODE_COPY[mode].blurb}
              </p>
              <div className="flight-mission-pills">
                {mode === 'classic' && (
                  <span className="flight-mission-pill">
                    <CloudIcon size={14} /> {MISSION_LENGTH} letters this trip
                    {focusLetters.length > 0 ? ` · focus ${focusLetters.join(' ')}` : ''}
                  </span>
                )}
                {mode === 'name' && (
                  <span className="flight-mission-pill">
                    <CloudIcon size={14} /> {nameQueue.map((q) => q.displayChar).join(' ')}
                  </span>
                )}
                <span className="flight-mission-pill">
                  {Math.round(state.settings.missionDurationSeconds / 60)} min of daylight{isPlannedMode(mode) ? '' : ' to start'}
                </span>
              </div>
              <button type="button" className="btn btn-primary btn-lg font-display flight-takeoff-btn" onClick={handleTakeOff}>
                Take Off!
              </button>
              <button
                type="button"
                className="flight-nest-btn font-display"
                onClick={() => {
                  sfx.unlock();
                  sfx.play('tap');
                  onOpenNest();
                }}
              >
                <NestEggIcon /> My nest
              </button>
            </div>
          </div>
        </div>
      </ScreenTransition>
    );
  }

  if (phase === 'end') {
    const outcomes = Array.from(outcomesRef.current.entries());
    // 'collected' only means the round of clouds ran out — a letter the
    // bird flew past unanswered still counts toward that, so "every
    // letter found" is only honest when every planned letter got an
    // answer.
    const caughtAll = !isPlannedMode(mode) || outcomes.length >= missionPlan.length;
    const starsEarned = Math.max(0, state.starsTotal - starsAtStartRef.current);
    const newlyMastered = Object.values(state.letters)
      .filter((l) => l.box >= 4 && !masteredAtStartRef.current.has(l.letter))
      .map((l) => l.letter)
      .sort();
    const nameFlown = mode === 'name' && endReason === 'collected';
    const title = nameFlown
      ? 'You flew your name!'
      : endReason === 'collected'
        ? "You're home!"
        : endReason === 'landed'
          ? 'Safe landing!'
          : "Home for the night!";
    const sub = nameFlown
      ? caughtAll
        ? `Every letter of ${profile?.name} caught — you spelled your whole name in the sky!`
        : `You spelled ${profile?.name} in the sky! The faint letters slipped past — catch them next time.`
      : endReason === 'collected'
        ? caughtAll
          ? 'Every letter found and carried safely back to the nest. Amazing flying!'
          : outcomes.length === 0
            ? 'The letters slipped past in the clouds this time — tap one next flight to catch it!'
            : 'A few letters slipped past in the clouds — they’ll be waiting on the next flight.'
        : endReason === 'time'
          ? 'The stars came out while you were exploring — and you still made it home.'
          : endReason === 'endless'
            ? `Night finally caught up, but you kept it away through ${foundCount} letter${foundCount === 1 ? '' : 's'}!`
            : endReason === 'sprint'
              ? `Night caught up after ${foundCount} letter${foundCount === 1 ? '' : 's'} — every bonus bought you daylight!`
              : 'You landed early — the nest is glad to see you anyway.';
    return (
      <ScreenTransition transitionKey={phase}>
        <div className="flight-end night-stage">
          <NightBackdrop />
          {newlyMastered.length > 0 && <Confetti />}
          <div className="flight-end-content stagger">
            <h1 className="flight-end-title font-display">{title}</h1>
            <p className="flight-end-sub">{sub}</p>
            <div className="flight-end-card">
              <div className="flight-end-nest">
                <NestIllustration size={200} />
              </div>
              {nameFlown && (
                <div className="flight-end-name" aria-label={profile?.name}>
                  {missionPlan.map((q, i) => (
                    <span
                      key={i}
                      className={slotOutcomes[i] && slotOutcomes[i] !== 'missed' ? 'caught' : 'missed'}
                      style={{ animationDelay: `${0.9 + i * 0.55}s` }}
                    >
                      {q.displayChar}
                    </span>
                  ))}
                </div>
              )}
              {newlyMastered.length > 0 && <MasteredBanner letters={newlyMastered} />}
              <div className="flight-end-stars" aria-label={`${starsEarned} stars earned this flight`}>
                <StarIcon size={26} color="var(--sun-dark)" />
                <span className="flight-end-stars-count">+{starsEarned}</span>
                <span className="flight-end-stars-label">{starsEarned === 1 ? 'star' : 'stars'} this flight</span>
              </div>
              {outcomes.length > 0 ? (
                <ul className="flight-end-letters" aria-label="Letters this flight">
                  {outcomes.map(([letter, outcome]) => (
                    <li key={letter} className={`flight-end-letter ${outcome}`}>
                      <span className="flight-end-letter-glyph">{letter}</span>
                      <span className="flight-end-letter-note">{outcome === 'bonus' ? 'bonus!' : outcome === 'knew' ? 'knew it' : 'next time'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flight-end-empty">No letters caught this trip — the clouds will be back tomorrow.</p>
              )}
              <button
                type="button"
                className="btn btn-primary btn-lg font-display"
                onClick={() => {
                  sfx.play('tap');
                  void handleTakeOff();
                }}
              >
                Fly Again
              </button>
              <button
                type="button"
                className="flight-nest-btn font-display"
                onClick={() => {
                  sfx.play('tap');
                  onOpenNest();
                }}
              >
                <NestEggIcon /> {newlyMastered.length > 0 ? 'See my new chicks!' : 'See my nest'}
              </button>
              <button
                type="button"
                className="flight-end-link"
                onClick={() => {
                  sfx.play('tap');
                  setPhase('intro');
                }}
              >
                Change flight mode
              </button>
            </div>
            <div className="flight-end-corner">
              <HoldButton onComplete={onOpenDashboard} className="flight-grownups-btn" ariaLabel="Grown-ups: hold to open the progress dashboard">
                <GrownUpIcon size={16} />
                <span>Grown-ups</span>
              </HoldButton>
            </div>
          </div>
        </div>
      </ScreenTransition>
    );
  }

  const paused =
    activeLetter !== null ||
    devPanelOpen ||
    pauseOpen ||
    tracingHold ||
    writing !== null ||
    planeChallenge !== null ||
    letterMatchup !== null ||
    cvcRound !== null ||
    handwritingOpen;
  // A letter that's already been missed a couple of times this flight
  // gets steered toward tracing specifically, overriding the normal
  // rotating hint — see STRUGGLE_THRESHOLD's doc comment above.
  const strugglingHint =
    encounter && encounter.status === 'pending' && (missStreakRef.current.get(encounter.canonicalLetter) ?? 0) >= STRUGGLE_THRESHOLD
      ? { key: 'trace-struggle', icon: <TraceIcon size={15} />, text: 'Trace the letter with your finger for a bonus' }
      : null;
  // No hint during a plane round — there's no cloud to tap/trace/type,
  // and the banner above already carries the round's own instruction;
  // pickHint would otherwise default to "Tap the cloud..." (encounter
  // is null, so its seed falls back to 0), which is actively wrong here.
  const hint = planeChallenge || letterMatchup || cvcRound || rainbowRound || stormRound || vowelRound ? null : (strugglingHint ?? pickHint(touchOnly, pictureChoices !== null, encounter?.distance ?? 0));
  // One shared "what to do" banner for whichever special round (if any)
  // is active — see the JSX below where this is rendered.
  const specialRoundPrompt = planeChallenge
    ? { text: 'Which plane has the letter I said?', replay: () => sayLetterAloud(planeChallenge.letter) }
    : letterMatchup
      ? { text: 'Which one did I say?', replay: () => sayLetterAloud(letterMatchup.target) }
      : cvcRound
        ? { text: 'Catch the letters in order to spell a word!', replay: () => blendLetter(cvcRound.letters[cvcRound.nextIndex]) }
        : rainbowRound && !rainbowRound.solved
          ? { text: RAINBOW_PROMPT, replay: () => speak(RAINBOW_PROMPT) }
          : stormRound && !stormRound.solved
            ? { text: STORM_PROMPT, replay: () => void announceStorm(stormRound) }
            : vowelRound && !vowelRound.solved
              ? { text: VOWEL_PROMPT, replay: () => void announceVowel(vowelRound) }
              : null;
  const otherCase = encounter ? (encounter.displayChar === encounter.canonicalLetter ? encounter.canonicalLetter.toLowerCase() : encounter.canonicalLetter) : null;

  return (
    <ScreenTransition transitionKey={phase}>
      {/* data-encounter-letter: the glyph currently in the sky, for
          automated playthroughs and assistive tooling — nothing in the
          UI reads it. */}
      <div className="flight-game" data-encounter-letter={encounter?.displayChar ?? ''} data-encounter-status={encounter?.status ?? ''}
        data-storm-cards={stormRound?.cardIds.join(',') ?? ''}
        data-storm-odd={stormRound?.oddId ?? ''}
      >
        <div className="flight-canvas-wrap">
          <Suspense fallback={<FlightLoadingVeil />}>
            <FlightCanvas
              missionDurationSeconds={state.settings.missionDurationSeconds}
              missionProgress={missionPlan.length > 0 ? planIndex / missionPlan.length : 0}
              // The name flight runs on Classic's day arc (a fixed plan, night at the end).
              mode={mode === 'name' ? 'classic' : mode}
              correctTick={correctTick}
              sprintTimeAdjust={sprintTimeAdjust}
              encounter={encounter}
              paused={paused}
              onTapLetter={handleTapLetter}
              onPassed={handlePassed}
              onFadeComplete={handleFadeComplete}
              onMissionTimeUp={handleMissionTimeUp}
              onHoverCaseSwap={handleHoverCaseSwap}
              devOcean={devPanelOpen ? devOceanParams : undefined}
              pictureChoices={pictureChoices}
              wrongPickId={wrongPickId}
              solvedPickId={solvedPickId}
              onPicturePick={handlePicturePick}
              onTraceComplete={handleTraceComplete}
              onTraceActive={handleTraceActive}
              lookFrozen={tracingHold}
              planeChallenge={planeChallenge}
              wrongPlaneOption={wrongPlaneOption}
              onPlanePick={handlePlanePick}
              letterMatchup={letterMatchup}
              wrongMatchupOption={wrongMatchupOption}
              onMatchupPick={handleMatchupPick}
              cvcRound={cvcRound}
              wrongCvcIndex={wrongCvcIndex}
              onCvcSlotTap={handleCvcSlotTap}
              rainbowRound={rainbowRound}
              onRainbowPassed={handleRainbowPassed}
              stormRound={stormRound}
              onStormPick={(id) => void handleStormPick(id)}
              weather={
                (stormRound && !stormRound.solved) || (vowelRound && !vowelRound.solved)
                  ? 'storm'
                  : stormRound || vowelRound
                    ? 'clearing'
                    : null
              }
              strikeKey={strikeKey}
              birdDistanceRef={birdDistanceRef}
              masteredCount={masteredLetterCount}
            />
          </Suspense>
          {devPanelOpen && <DevOceanPanel params={devOceanParams} onChange={setDevOceanParams} onClose={() => setDevPanelOpen(false)} />}
        </div>

        <div className="flight-topbar">
          <button
            type="button"
            className="icon-btn flight-pause-btn"
            onClick={() => {
              sfx.play('tap');
              setPauseOpen(true);
            }}
            aria-label="Pause"
          >
            <PauseIcon size={18} />
          </button>

          {isPlannedMode(mode) ? (
            <ol
              className={`flight-slots${mode === 'name' ? ' name-slots' : ''}`}
              aria-label={`${Object.keys(slotOutcomes).length} of ${missionPlan.length} letters caught`}
            >
              {missionPlan.map((item, i) => {
                const outcome = slotOutcomes[i];
                const isCurrent = i === planIndex && !outcome;
                const isPassed = i < planIndex && !outcome;
                // The name flight shows the whole name from the start —
                // faint until each letter is caught — so the child watches it spell itself.
                const shown = mode === 'name' ? item.displayChar : outcome || isPassed ? item.canonicalLetter : '';
                return (
                  <li key={i} className={`flight-slot${outcome ? ` ${outcome}` : ''}${isCurrent ? ' current' : ''}${isPassed ? ' passed' : ''}`}>
                    {shown}
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="flight-progress-pill">
              <CloudIcon size={15} /> {foundCount} {foundCount === 1 ? 'letter' : 'letters'}
            </div>
          )}

          <div className="flight-topbar-right">
            {streak >= 2 && (
              <div
                key={streak}
                className={`flight-combo flight-combo-${streak >= 10 ? 'hot' : streak >= 5 ? 'warm' : 'mild'}`}
                aria-live="polite"
                aria-label={`${streak} in a row`}
              >
                <FlameIcon size={14} />
                <span>{streak}</span>
              </div>
            )}
            <div className="flight-stars" aria-live="polite" aria-label={`${state.starsTotal} stars`}>
              <StarIcon size={17} color="var(--sun-dark)" />
              <span key={state.starsTotal} className="flight-stars-count">
                {state.starsTotal}
              </span>
            </div>
          </div>
        </div>

        {toast && (
          <div className={`flight-toast ${toast.kind}`} role="status">
            {toast.kind !== 'gentle' && <StarIcon size={15} />} {toast.text}
          </div>
        )}

        {vowelRound && <VowelStorm round={vowelRound} onPick={(v) => void handleVowelPick(v)} />}

        {specialRoundPrompt && (
          <div className="plane-challenge-banner">
            <p className="plane-challenge-prompt">{specialRoundPrompt.text}</p>
            <button type="button" className="plane-challenge-replay" onClick={specialRoundPrompt.replay} aria-label="Hear the letter again">
              <SpeakerIcon color="var(--sky-dark, #2e7fa8)" />
            </button>
          </div>
        )}

        <div className="flight-bottombar">
          {rainbowRound && (
            <div className={`rainbow-options${rainbowRound.solved ? ' done' : ''}`} role="group" aria-label="Pick the glowing colour">
              {rainbowRound.options.map((id) => {
                const color = RAINBOW_COLORS.find((c) => c.id === id)!;
                const isAnswer = rainbowRound.solved && id === RAINBOW_COLORS[rainbowRound.glowIndex].id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`rainbow-option${wrongRainbowOption === id ? ' wrong' : ''}${isAnswer ? ' solved' : ''}`}
                    onClick={() => handleRainbowPick(id)}
                    disabled={rainbowRound.solved && !isAnswer}
                  >
                    <span className="rainbow-swatch" style={{ background: color.hex }} aria-hidden="true" />
                    <span className="rainbow-word">
                      <strong>{color.word[0]}</strong>
                      {color.word.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {encounter && (encounter.status === 'pending' || encounter.status === 'active') && (
            <div className="flight-bottom-actions">
              <SpeechLetterButton ref={speechButtonRef} key={encounter.distance} targetLetter={encounter.canonicalLetter} onMatch={handleSpeechMatch} showKeyHint={!touchOnly} />
              {/* Tap equivalent of FlightScene's hover-to-swap-case bonus
                  (mouse-only — there's no touch "hover"), so a
                  touch/mobile player has some way to see the letter in
                  its other case too, not just desktop mouse users. Reuses
                  the same handleHoverCaseSwap the hover path calls, which
                  already no-ops mid-trace, so no extra guard needed here. */}
              <button
                type="button"
                className="case-switch-btn"
                onClick={() => handleHoverCaseSwap(encounter.canonicalLetter)}
                aria-label={otherCase ? `Show as ${otherCase}` : 'Show other case'}
              >
                <SwapCaseIcon color="var(--sky-dark, #2e7fa8)" size={15} />
                <span>Aa</span>
              </button>
              {state.settings.handwritingCheck && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && (
                <button
                  type="button"
                  className="case-switch-btn"
                  onClick={() => {
                    sfx.play('tap');
                    setHandwritingOpen(true);
                  }}
                  aria-label="Write the letter on paper for a bonus"
                >
                  <CameraIcon color="var(--sky-dark, #2e7fa8)" size={15} />
                  <span>Write it</span>
                </button>
              )}
            </div>
          )}
          {hint && (
            <div className="flight-hint" key={hint.key}>
              {hint.icon} {hint.text}
            </div>
          )}
        </div>

        {activeLetter && encounter && (
          <div className="flight-hud-overlay">
            <div className="flight-hud-card">
              {/* Show the letter in whatever case the cloud actually
                  displayed (case-progression can make this lowercase) —
                  showing the canonical uppercase here regardless would
                  silently contradict what the child just saw and tapped. */}
              <span className="flight-hud-letter" aria-label={`The letter ${activeLetter}`}>
                {encounter.displayChar}
              </span>
              <span className="flight-hud-cases" aria-hidden="true">
                <span className="is-shown">{encounter.displayChar}</span>
                <span>{otherCase}</span>
              </span>
              <button type="button" className="flight-hud-replay" onClick={handleReplay}>
                <SpeakerIcon color="var(--sky-dark, #2e7fa8)" /> Hear it again
              </button>
              <p className="flight-hud-question">Did you know this letter?</p>
              <div className="flight-hud-arrows">
                <button type="button" className="flight-hud-arrow-btn no" onClick={() => handleAnswer(false)}>
                  <ArrowLeftIcon color="var(--ink-soft, #7a6b5a)" size={18} /> Not yet
                </button>
                <button type="button" className="flight-hud-arrow-btn yes" onClick={() => handleAnswer(true)}>
                  Knew it! <ArrowRightIcon color="white" size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {writing && state.settings.writingPractice !== 'off' && (
          <WritingPractice letter={writing.letter} mode={state.settings.writingPractice} onComplete={() => closeWriting(true)} onSkip={() => closeWriting(false)} />
        )}

        {handwritingOpen && encounter && (
          <HandwritingCheck letter={encounter.displayChar} onMatch={handleHandwritingMatch} onClose={() => setHandwritingOpen(false)} />
        )}

        {pauseOpen && (
          <div className="flight-pause-overlay" role="dialog" aria-modal="true" aria-label="Paused">
            <div className="flight-pause-card">
              {profile && (
                <div className="flight-pause-avatar">
                  <AvatarIcon avatar={profile.avatar} size={56} />
                </div>
              )}
              <h2 className="flight-pause-title font-display">Paused</h2>
              <p className="flight-pause-sub">The sky is holding still for you.</p>
              <button
                type="button"
                className="btn btn-primary btn-lg font-display flight-pause-resume"
                onClick={() => {
                  sfx.play('tap');
                  setPauseOpen(false);
                }}
                autoFocus
              >
                <PlayIcon size={18} /> Keep flying
              </button>
              <button
                type="button"
                className="btn btn-secondary font-display"
                onClick={() => {
                  sfx.play('tap');
                  finishMission('landed');
                }}
              >
                <NestIcon size={18} /> Fly home now
              </button>
              <div className="flight-pause-row">
                {soundToggle}
                <HoldButton onComplete={openDashboardFromPlay} className="flight-grownups-btn" ariaLabel="Grown-ups: hold to open the progress dashboard">
                  <GrownUpIcon size={16} />
                  <span>Grown-ups</span>
                </HoldButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenTransition>
  );
}

/** One rotating, device-aware hint — a touch-only tablet never sees "type the letter". Changes per encounter so the child gradually meets every way to play. */
function pickHint(touchOnly: boolean, hasPictures: boolean, encounterSeed: number): { key: string; icon: React.ReactNode; text: string } | null {
  const hints: { key: string; icon: React.ReactNode; text: string }[] = [
    { key: 'tap', icon: <HandTapIcon size={15} />, text: 'Tap the cloud to hear its letter' },
    { key: 'trace', icon: <TraceIcon size={15} />, text: 'Trace the letter with your finger for a bonus' },
  ];
  if (!touchOnly) hints.push({ key: 'type', icon: <KeyboardIcon size={15} color="currentColor" />, text: 'Type the letter for a bonus' });
  if (hasPictures) hints.push({ key: 'picture', icon: <PictureIcon size={15} />, text: 'Spot the picture that starts with it' });
  if (isTiltCapable()) hints.push({ key: 'tilt', icon: <CloudIcon size={15} />, text: 'Tilt your tablet to look around the sky' });
  if (hints.length === 0) return null;
  return hints[Math.floor(encounterSeed) % hints.length];
}

const STARS = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 58}%`,
  size: 2 + ((i * 7) % 3),
  delay: `${(i % 6) * 0.45}s`,
}));

/** Deep-blue evening sky with twinkling stars for the end-of-flight screen — the flight always ends after dark. */
function NightBackdrop() {
  return (
    <div className="night-backdrop" aria-hidden="true">
      {STARS.map((s, i) => (
        <span key={i} className="night-star" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }} />
      ))}
      <div className="night-moon" />
      <div className="night-sea" />
    </div>
  );
}

const CONFETTI_COLORS = ['var(--coral)', 'var(--sun)', 'var(--leaf)', 'var(--sky)', 'var(--berry)', '#ffffff'];
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: `${(i * 29) % 100}%`,
  delay: `${((i * 13) % 20) / 10}s`,
  duration: `${3.2 + ((i * 7) % 5) * 0.35}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotate: `${(i * 47) % 360}deg`,
  size: 7 + ((i * 3) % 4),
}));

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: c.left, animationDelay: c.delay, animationDuration: c.duration, background: c.color, width: c.size, height: c.size * 1.6, ['--rot' as string]: c.rotate }}
        />
      ))}
    </div>
  );
}

function MasteredBanner({ letters }: { letters: string[] }) {
  useEffect(() => {
    const t = setTimeout(() => sfx.play('mastered'), 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flight-mastered" role="status">
      <span className="flight-mastered-eyebrow">{letters.length === 1 ? 'New letter mastered!' : 'New letters mastered!'}</span>
      <div className="flight-mastered-badges">
        {letters.map((l, i) => (
          <span key={l} className="flight-mastered-badge" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
            {l}
          </span>
        ))}
      </div>
      <span className="flight-mastered-line">You knew the sound. Now you know its shape.</span>
    </div>
  );
}
