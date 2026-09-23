import { useState, useRef, useEffect, useMemo, Suspense, lazy } from 'react';
import { useApp } from '../state/AppContext';
import { speak } from '../engine/audio';
import * as sfx from '../engine/sfx';
import { preloadFonts, isTouchOnlyDevice } from '../engine/preload';
import { requestTiltPermission, recenterTilt, isTiltCapable } from '../engine/tilt';
import { buildMissionQueue, pickEndlessItem, MISSION_LENGTH } from '../engine/flightMission';
import { buildPictureChoices, type PictureChoiceEntry } from '../engine/pictureChoice';
import { buildPlaneChoiceRound, type PlaneChoiceRound } from '../engine/planeChoice';
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
type Mode = 'classic' | 'endless' | 'sprint';
/** Per-letter outcome recorded for the HUD slots + end screen. Last outcome wins for a letter that repeats (endless mode). */
type Outcome = 'knew' | 'bonus' | 'missed';
// Sprint mode's time penalty/reward — see FlightScene's sprintTimeAdjust doc comment.
const SPRINT_BONUS_SECONDS = 3;
const SPRINT_MISTAKE_SECONDS = -2;

const MODE_COPY: Record<Mode, { label: string; blurb: string }> = {
  classic: { label: 'Classic', blurb: `Find ${MISSION_LENGTH} letters before the stars come out.` },
  endless: { label: 'Endless', blurb: 'Keep flying as long as you can — every letter you know pushes night back a little.' },
  sprint: { label: 'Sprint', blurb: 'A race against the sun: a bonus buys extra daylight, a miss makes it set faster.' },
};

function spawnEncounter(item: QueueItem, distance: number): Encounter {
  return { ...item, distance, laneX: randomLane(), status: 'pending' };
}

/**
 * The flight game's outer half — owns mission/React state and the DOM
 * HUD/intro/end screens; FlightScene.tsx owns the R3F/Three.js tree
 * and the per-frame mission clock. See docs/10-flight-game.md for the
 * full design.
 */
export function FlightGameScreen({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  const { state, answer, logSession, awardStars, setSoundEnabled } = useApp();
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
  const [pictureChoices, setPictureChoices] = useState<PictureChoiceEntry[] | null>(null);
  const [wrongPickId, setWrongPickId] = useState<string | null>(null);
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

  const nextSpawnDistanceRef = useRef(SPAWN_DISTANCE_AHEAD);
  const roundsUntilPlaneRef = useRef(PLANE_ROUND_EVERY);
  const roundsUntilCvcRef = useRef(CVC_ROUND_EVERY);
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

  // Warm everything the flight needs while the child is still reading
  // the intro: the 2.5MB bird mesh and the fonts the letter clouds are
  // rasterized from. Both are cached, so a second "Fly Again" is instant.
  useEffect(() => {
    void loadFlightChunk();
    void preloadFonts();
  }, []);

  useEffect(() => {
    sfx.setMuted(!state.settings.soundEnabled);
  }, [state.settings.soundEnabled]);

  // Leaving the screen (dashboard, player switch) mid-ambient: fade out.
  useEffect(
    () => () => {
      sfx.stopAmbient();
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
    if (mode === 'classic') setSlotOutcomes((prev) => ({ ...prev, [planIndex]: outcome }));
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
    roundsUntilCvcRef.current -= 1;
    if (roundsUntilCvcRef.current <= 0) {
      roundsUntilCvcRef.current = CVC_ROUND_EVERY;
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
      presentItem(pickEndlessItem(state.letters, profile?.readingLevel), SPAWN_DISTANCE_AHEAD);
    } else {
      const plan = buildMissionQueue(state.letters, MISSION_LENGTH, profile?.readingLevel);
      setMissionPlan(plan);
      setPlanIndex(0);
      if (plan.length > 0) presentItem(plan[0], SPAWN_DISTANCE_AHEAD);
      else setEncounter(null);
    }
    setPhase('flying');
    sfx.startAmbient();
  }

  function finishMission(reason: EndReason) {
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
    speak(canonicalLetter);
  }

  function handleReplay() {
    sfx.play('tap');
    if (activeLetter) speak(activeLetter);
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
    setPictureChoices(encounterLetter ? buildPictureChoices(encounterLetter) : null);
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
    speak(letter);
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
    if (!choice.isTarget) {
      sfx.play('miss');
      setWrongPickId(choice.word.id);
      setTimeout(() => setWrongPickId(null), 400);
      breakStreak();
      return;
    }
    awardBonusSolve(encounter.canonicalLetter, `${choice.word.word} starts with ${encounter.canonicalLetter}! +${1 + TYPE_BONUS_STARS} stars`);
  }

  // Speaks the round's target letter once when it starts — this IS the
  // prompt (there's no glyph on screen to read, unlike every other
  // path), so it can't be an optional nice-to-have the way handleReplay
  // is elsewhere. Keyed on the planeChallenge object itself, which is a
  // fresh reference each time a new round starts and null in between, so
  // this fires exactly once per round and never on an unrelated re-render.
  useEffect(() => {
    if (planeChallenge) speak(planeChallenge.letter);
  }, [planeChallenge]);

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
    if (letterMatchup) speak(letterMatchup.target);
  }, [letterMatchup]);

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
    speak(cvcRound.letters[index]);
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
      // A beat after the last letter's own sound (just spoken above),
      // then the whole blended word — hearing both is the actual point.
      setTimeout(() => speak(word), 350);
      setTimeout(() => {
        setCvcRound(null);
        resumeAfterSpecialRound();
      }, CVC_WORD_PAUSE_MS);
    }
  }

  const handleTypeLetterRef = useRef(handleTypeLetter);
  handleTypeLetterRef.current = handleTypeLetter;

  useEffect(() => {
    if (phase !== 'flying') return;
    function onKeyDown(e: KeyboardEvent) {
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
      presentItem(pickEndlessItem(state.letters, profile?.readingLevel), nextSpawnDistanceRef.current);
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
        <div className="flight-intro sky-stage">
          <SkyBackdrop />
          <div className="flight-intro-corner">
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
                <button type="button" className="btn btn-primary font-display" onClick={() => setAboutOpen(false)}>
                  Keep flying
                </button>
              </div>
            </div>
          )}
          <div className="flight-intro-content stagger">
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
              <p className="flight-mode-desc">{MODE_COPY[mode].blurb}</p>
              <div className="flight-mission-pills">
                {mode === 'classic' && (
                  <span className="flight-mission-pill">
                    <CloudIcon size={14} /> {MISSION_LENGTH} letters this trip
                  </span>
                )}
                <span className="flight-mission-pill">
                  {Math.round(state.settings.missionDurationSeconds / 60)} min of daylight{mode !== 'classic' ? ' to start' : ''}
                </span>
              </div>
              <button type="button" className="btn btn-primary btn-lg font-display flight-takeoff-btn" onClick={handleTakeOff}>
                Take Off!
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
    const caughtAll = mode !== 'classic' || outcomes.length >= missionPlan.length;
    const starsEarned = Math.max(0, state.starsTotal - starsAtStartRef.current);
    const newlyMastered = Object.values(state.letters)
      .filter((l) => l.box >= 4 && !masteredAtStartRef.current.has(l.letter))
      .map((l) => l.letter)
      .sort();
    const title =
      endReason === 'collected'
        ? "You're home!"
        : endReason === 'landed'
          ? 'Safe landing!'
          : "Home for the night!";
    const sub =
      endReason === 'collected'
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
  const hint = planeChallenge || letterMatchup || cvcRound ? null : (strugglingHint ?? pickHint(touchOnly, pictureChoices !== null, encounter?.distance ?? 0));
  // One shared "what to do" banner for whichever special round (if any)
  // is active — see the JSX below where this is rendered.
  const specialRoundPrompt = planeChallenge
    ? { text: 'Which plane has the letter I said?', replay: () => speak(planeChallenge.letter) }
    : letterMatchup
      ? { text: 'Which one did I say?', replay: () => speak(letterMatchup.target) }
      : cvcRound
        ? { text: 'Catch the letters in order to spell a word!', replay: () => speak(cvcRound.letters[cvcRound.nextIndex]) }
        : null;
  const otherCase = encounter ? (encounter.displayChar === encounter.canonicalLetter ? encounter.canonicalLetter.toLowerCase() : encounter.canonicalLetter) : null;

  return (
    <ScreenTransition transitionKey={phase}>
      {/* data-encounter-letter: the glyph currently in the sky, for
          automated playthroughs and assistive tooling — nothing in the
          UI reads it. */}
      <div className="flight-game" data-encounter-letter={encounter?.displayChar ?? ''} data-encounter-status={encounter?.status ?? ''}>
        <div className="flight-canvas-wrap">
          <Suspense fallback={<FlightLoadingVeil />}>
            <FlightCanvas
              missionDurationSeconds={state.settings.missionDurationSeconds}
              missionProgress={missionPlan.length > 0 ? planIndex / missionPlan.length : 0}
              mode={mode}
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

          {mode === 'classic' ? (
            <ol className="flight-slots" aria-label={`${Object.keys(slotOutcomes).length} of ${missionPlan.length} letters caught`}>
              {missionPlan.map((item, i) => {
                const outcome = slotOutcomes[i];
                const isCurrent = i === planIndex && !outcome;
                const isPassed = i < planIndex && !outcome;
                return (
                  <li key={i} className={`flight-slot${outcome ? ` ${outcome}` : ''}${isCurrent ? ' current' : ''}${isPassed ? ' passed' : ''}`}>
                    {outcome || isPassed ? item.canonicalLetter : ''}
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

        {specialRoundPrompt && (
          <div className="plane-challenge-banner">
            <p className="plane-challenge-prompt">{specialRoundPrompt.text}</p>
            <button type="button" className="plane-challenge-replay" onClick={specialRoundPrompt.replay} aria-label="Hear the letter again">
              <SpeakerIcon color="var(--sky-dark, #2e7fa8)" />
            </button>
          </div>
        )}

        <div className="flight-bottombar">
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

/** Drifting CSS clouds + a warm sun behind the intro — a sky that's alive before the 3D one loads. */
function SkyBackdrop() {
  return (
    <div className="sky-backdrop" aria-hidden="true">
      <div className="sky-sun" />
      <div className="sky-cloud c1" />
      <div className="sky-cloud c2" />
      <div className="sky-cloud c3" />
      <div className="sky-cloud c4" />
      <div className="sky-sea" />
    </div>
  );
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
