import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OceanSky } from './OceanSky';
import { AlbatrossModel } from './AlbatrossModel';
import { LetterCloud } from './LetterCloud';
import { LetterTracer } from './LetterTracer';
import { FlashCardSky } from './FlashCardSky';
import { PlaneChoice } from './PlaneChoice';
import { LetterMatchup } from './LetterMatchup';
import { CvcWordRound } from './CvcWordRound';
import { CompanionFlock } from './CompanionFlock';
import { SkimSplash, SEA_CREST_Y, type SkimState } from './SkimSplash';
import * as sfx from '../engine/sfx';
import { MotionBlur } from './MotionBlur';
import { StormWeather } from './StormWeather';
import { StormCards, type StormCardsRound } from './StormCards';
import type { Encounter } from './flightTypes';
import { type OceanDevParams } from './oceanSky';
import type { PictureChoiceEntry } from '../engine/pictureChoice';
import type { TraceProgress } from '../engine/strokeGeometry';
import { subscribeTilt, isTiltLive } from '../engine/tilt';

const HOVER_CASE_SWAP_MS = 2000;
// How far ahead of the frozen camera a "special round" (plane-choice,
// letter-matchup) sits — same ballpark as MIN_VIEW_DISTANCE below
// (picture-choice's own "close enough to read, far enough to see the
// whole flight path" distance), not tied to FlightGameScreen's
// cloud-spawn cadence since neither round has an encounter/distance of
// its own.
const SPECIAL_ROUND_DISTANCE_AHEAD = 15;
// The streak-reward rainbow lives in the ocean shader (so it reflects) —
// see OceanSky.tsx's rainbow prop. It's a real place in the world: the
// flight keeps going (just slower) and the bird flies under the arch,
// ~30s away at the slowed speed. With the drone shot's true-to-life
// horizon (see OceanSky's truePitchRef) an arch grows out of the top of
// the frame once it's within ~1/3 of its starting distance whatever its
// scale, so the radius:distance ratio is kept modest — it stays on
// screen for roughly the first 20s, the window a child has to answer.
const RAINBOW_DISTANCE_AHEAD = 100;
const RAINBOW_RADIUS = RAINBOW_DISTANCE_AHEAD * 0.24;
// All six bands together — chunky, storybook proportions.
const RAINBOW_WIDTH = RAINBOW_RADIUS * 0.34;
const RAINBOW_CENTER_Y = -2;
// "A little bonus", not a stop: the flight eases to 85% while it's up.
const RAINBOW_SPEED_FACTOR = 0.85;
// Once the right colour is picked, the bird DASHES through the arch
// wherever it is — ~6× speed (≤5s from the farthest point), with a wider
// field of view and zoom motion blur (MotionBlur.tsx) selling the speed.
const RAINBOW_DASH_FACTOR = 6;
const DASH_FOV_KICK = 16;
const DASH_BLUR = 0.09;
const BASE_FOV = 60;
// The storm round (StormWeather.tsx / StormCards.tsx): the flight slows
// like it does for the rainbow; the weather eases in over ~2s; once it's
// solved the sky overshoots into a brief warm sunburst before settling.
const STORM_SPEED_FACTOR = 0.85;
const STORM_EASE = 1.3;
const STORM_CLEAR_BURST = -0.3;
// While the rainbow's up the chase cam swings out to a "drone" shot —
// above and off to the bird's side, looking a little ahead of it so the
// rainbow stays in frame — for a sense of occasion. Offsets are from
// the bird; the blend in/out takes DRONE_BLEND_SECONDS, eased.
// Side offset is scaled down on narrow (portrait) screens, where a wide
// side angle would push the bird out of the frame entirely.
const DRONE_SIDE = 3;
const DRONE_UP = 1.5;
const DRONE_BACK = 5.5;
const DRONE_LOOK_AHEAD = 14;
const DRONE_LOOK_DROP = 0.2;
const DRONE_BLEND_SECONDS = 1.6;
// ...and the albatross swoops down to skim the sea into it: wings locked
// in a glide, banking in slow S-curves so a wingtip clips the crests,
// with a comic belly-dip (squash, sploosh, hop) every few seconds — see
// SkimSplash.tsx for the spray/foam. Sea heights there are sampled from
// the ocean shader's own wave function.
const SKIM_BLEND_SECONDS = 2.2;
/** Body height while skimming — just over the tallest typical crests, so it's the banked wingtip that touches, not the belly. */
const SKIM_Y = SEA_CREST_Y + 0.3;
const SKIM_BANK = 0.32; // ±18°
const SKIM_BANK_HZ = 0.09;
// Wingtip in the bird group's local space (TIP_Z 0.58 × model scale 2.3, along X after the model's own rotation).
const WING_TIP_LOCAL = 1.33;
const DIP_SECONDS = 0.8;
const DIP_DEPTH = 0.5;
const DIP_GAP_MIN = 2.0;
const DIP_GAP_MAX = 3.6;

const PASS_BUFFER = 4; // world units past a cloud's distance before it counts as "flown through"
// The mission's day arc runs dawn -> noon -> sunset -> deep night, not just
// dawn-to-sunset — see oceanSky.ts's sun_cycle math: sin() zero-crossings
// sit at 6 (sunrise) and 18 (sunset), trough (darkest) near 24/0
// (midnight). Ending the mission at 22 lands well past sunset, in genuine
// night (stars out), which is the dramatic beat the user asked for.
// 7, not 6: the shader's sunrise zero-crossing at exactly 6 renders as a
// dark blue sky with an orange band — indistinguishable from dusk, so a
// mission looked like it started AND ended at night. An hour later the
// sky is a soft pink-blue morning (checked across a screenshot series at
// 5.5/6/6.5/7/7.5/8), which reads unambiguously as "the day is starting".
const DAWN = 7;
const NIGHT = 22;
// How far (world units) the chase-cam's aim lifts toward an approaching
// letter cloud at full steer — enough to keep the glyph framed instead
// of sliding off the top of the screen on final approach (visible in
// playtest screenshots), small enough to stay well inside the pitch
// range the ocean shader renders correctly (see docs bug #5).
const APPROACH_LOOK_LIFT = 1.35;
// Reaching NIGHT used to end the mission immediately — the moon/star sky
// already existed (see oceanSky.ts's getSkyColor: day_blend is already
// fully 0 by t=22, sun term gone, moon term fully active) but no one
// ever actually got to fly around in it. This holds the clock at NIGHT
// for a real stretch of additional play — a quarter of the mission's
// own configured length — before the mission actually ends, so the moon
// replacing the sun is something the child experiences, not a flash
// they see for one frame while the end screen is already sliding in.
const NIGHT_EXTENSION_FRACTION = 0.25;
// Past sunset (18, per the comment above) heading into real dark — the
// cutover point where the picture-choice bonus's candidates switch from
// day cloud/smoke-trail rendering to night constellation traces.
const NIGHT_ICON_THRESHOLD = 19;
// Shared between LetterCloud (the visible puffs) and LetterTracer (the
// coverage check + drawn trail) — they both sample the same glyph and
// must agree on world-units-per-canvas-pixel or the trace visually
// drifts from what's actually drawn.
const LETTER_CLOUD_SCALE = 0.045;

// Deterministic scatter for the picture-choice icons — stable per
// encounter+choice (so it doesn't jitter across re-renders) but
// different every spawn. The user asked for these to read as their own
// separate objects floating in the sky, not a row of buttons parked
// under the letter cloud — see the scatter offsets below.
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}
function seededRandom(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

interface FlightSceneProps {
  missionDurationSeconds: number;
  /** How far through the letter round (0-1, `planIndex / missionPlan.length`). Drives the day/night arc alongside elapsed time in 'classic' mode — see the `useFrame` below for why time alone isn't enough. Ignored in 'endless'/'sprint' modes. */
  missionProgress: number;
  /** 'classic': fixed round, day arc from time+progress (see missionProgress). 'endless': no fixed round — the clock always creeps toward night, but every correct answer rewinds it (correctTick), so accuracy directly buys more playtime. 'sprint': also no fixed round, but the clock only moves from real elapsed time and explicit +/- adjustments (sprintTimeAdjust) — a genuine bonus solve buys time, a self-reported miss costs it, a plain "knew it" does neither. */
  mode: 'classic' | 'endless' | 'sprint';
  /** Endless mode only: increments once per correct answer. Each increment rewinds the endless clock — see useFrame. */
  correctTick: number;
  /** Sprint mode only: running total of all +3 (bonus solve) / -2 (missed self-report) adjustments so far. FlightScene tracks the last value it applied and reacts to the delta each time this changes — see useFrame. */
  sprintTimeAdjust: number;
  encounter: Encounter | null;
  /** True while a HUD interaction is open — freezes forward flight AND the mission clock, not the idle glide/bank. */
  paused: boolean;
  speed?: number;
  altitude?: number;
  onTapLetter: (canonicalLetter: string) => void;
  onPassed: (canonicalLetter: string) => void;
  /** `birdDistance` is the bird's own traveled distance at the moment this fires — the parent uses it to place the next encounter a fixed distance ahead of where the bird actually is right now, not accumulated from a fixed schedule (see FlightGameScreen's handleFadeComplete for why that drifted). */
  onFadeComplete: (canonicalLetter: string, birdDistance: number) => void;
  onMissionTimeUp: () => void;
  onHoverCaseSwap: (canonicalLetter: string) => void;
  /** Dev-only sea/sky tuning (see DevOceanPanel.tsx) — when present, overrides the normal mission-clock-driven day arc entirely so a tuner can hold time-of-day still. */
  devOcean?: OceanDevParams;
  /** The current encounter's picture-choice candidates (see engine/pictureChoice.ts) — rendered as in-world sky shapes next to the letter cloud, not a flat HUD row. Null/undefined when no bonus is offered this encounter. */
  pictureChoices?: PictureChoiceEntry[] | null;
  /** Which candidate (by word id) just got a wrong tap — triggers that one icon's shake, then clears. */
  wrongPickId?: string | null;
  /** Which candidate (by word id) was correctly picked — triggers celebratory reveal and word display. */
  solvedPickId?: string | null;
  onPicturePick?: (choice: PictureChoiceEntry) => void;
  /** Fired once when a child drags/traces over enough of the current letter's own shape — a fourth bonus path alongside tap, type, and picture-choice. See LetterTracer.tsx. */
  onTraceComplete: (canonicalLetter: string) => void;
  /** True on the pointer-down that begins a trace, false when it ends — FlightGameScreen turns this into a flight freeze with a short hold-over. */
  onTraceActive: (active: boolean) => void;
  /** While true the mouse/tilt parallax stops easing toward new input — a child tracing on a wobbling tablet must see a letter that holds perfectly still. */
  lookFrozen: boolean;
  /** "Hear the name, pick the plane" bonus round — see PlaneChoice.tsx and FlightGameScreen's planeChallenge. Replaces the normal encounter entirely for this queue item (no letter cloud spawns while this is set); `paused` is already true throughout, same as any other HUD interlude. */
  planeChallenge?: { options: string[] } | null;
  wrongPlaneOption?: string | null;
  onPlanePick?: (option: string) => void;
  /** "Which one did I say?" round — see LetterMatchup.tsx and FlightGameScreen's letterMatchup. Same "replaces the encounter entirely" shape as planeChallenge above. */
  letterMatchup?: { options: [string, string] } | null;
  wrongMatchupOption?: string | null;
  onMatchupPick?: (option: string) => void;
  /** "Catch the letters in order, blend them into a word" bonus — see CvcWordRound.tsx and FlightGameScreen's cvcRound. `id` is stable for the whole round (unlike the object itself, which gets a new `nextIndex` every tap) — see FlightScene's cvcRoundDistance for why that distinction matters. */
  cvcRound?: { id: string; letters: [string, string, string]; nextIndex: number } | null;
  wrongCvcIndex?: number | null;
  onCvcSlotTap?: (index: number) => void;
  /** "Which colour is glowing?" streak-reward round — see FlightGameScreen's rainbowRound. Drawn by OceanSky; the answers are DOM swatches. Unlike the other rounds it doesn't pause the flight, only slows it. */
  rainbowRound?: { glowIndex: number; solved: boolean } | null;
  /** The storm's "which one starts with a different sound?" round — see StormCards.tsx / engine/oddSound.ts. Like the rainbow it slows the flight rather than pausing it. */
  stormRound?: StormCardsRound | null;
  onStormPick?: (cardId: string) => void;
  /** Storm weather, shared by both storm rounds (cards + Storm Vowels): 'storm' while one is open, 'clearing' once it's solved (the sunburst), null otherwise. */
  weather?: 'storm' | 'clearing' | null;
  /** Bumping this calls down a lightning strike right now (Storm Vowels' payoff). */
  strikeKey?: number;
  /** Fires once when the camera passes under the rainbow's arch, with the bird's distance at that moment. */
  onRainbowPassed?: (birdDistance: number) => void;
  /** Written every frame with the bird's travelled distance — for the parent's spawn math when a round ends mid-flight (the rainbow's), where there's no onFadeComplete to hand it over. */
  birdDistanceRef?: React.RefObject<number>;
  /** How many letters the child has mastered (box >= 4) — see FlightGameScreen.tsx. Drives CompanionFlock, the small creatures that join the bird's formation as a persistent, visible collection reward. */
  masteredCount?: number;
  /** Live 0..1 frame-rate calibration level (see adaptiveQuality.ts) — FlightCanvas supplies it; OceanSky turns it into ocean detail every frame. */
  qualityRef?: React.RefObject<number>;
}

function EncounterCloud({
  encounter,
  altitude,
  isNight,
  nightDimRef,
  onTap,
  onFadeComplete,
  onHoverCaseSwap,
  onTraceComplete,
  onTraceActive,
}: {
  encounter: Encounter;
  altitude: number;
  isNight: boolean;
  nightDimRef: React.RefObject<number>;
  onTap: () => void;
  onFadeComplete: () => void;
  onHoverCaseSwap: () => void;
  onTraceComplete: () => void;
  onTraceActive: (active: boolean) => void;
}) {
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearHoverTimer() {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }

  function handleTap() {
    if (encounter.status === 'pending') onTap();
  }

  // Hovering (mouse only — there's no touch equivalent, which is fine,
  // it's a bonus discovery for a desktop/mouse player, not a required
  // path) over a still-undecided cloud for HOVER_CASE_SWAP_MS flips it
  // to the other case, letting a curious kid see both forms without
  // committing to an answer.
  function handlePointerOver(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    if (encounter.status !== 'pending') return;
    clearHoverTimer();
    hoverTimeoutRef.current = setTimeout(onHoverCaseSwap, HOVER_CASE_SWAP_MS);
  }

  function handlePointerOut(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    clearHoverTimer();
  }

  useEffect(() => clearHoverTimer, []);

  // Shared with LetterTracer (writes, as the child traces) and LetterCloud
  // (reads, only at night — NightLetterCloud's constellation reveal). One
  // ref per encounter so LetterCloud can see live progress without owning
  // any of the scoring logic itself.
  const traceProgressRef = useRef<TraceProgress>({ covered: [], done: [], version: 0 });

  return (
    <group position={[encounter.laneX, altitude + 2.5, -encounter.distance]}>
      <LetterCloud
        letter={encounter.displayChar}
        scale={LETTER_CLOUD_SCALE}
        fadeOut={encounter.status === 'passed'}
        burst={encounter.status === 'typed'}
        glow={encounter.status === 'glowing'}
        tint={encounter.status === 'answered' && encounter.knew ? 'gold' : 'none'}
        nightDimRef={nightDimRef}
        isNight={isNight}
        progressRef={traceProgressRef}
        onFadeComplete={onFadeComplete}
      />
      {/* Invisible, larger-than-the-puffs hover target for the case-swap
          bonus (below) — raycasting against thousands of tiny instanced
          sprites individually is unreliable; a simple sphere proxy is
          cheap and forgiving for small fingers. Tapping and tracing are
          handled by LetterTracer instead (see its own doc comment for
          why that needs real DOM pointer capture, not R3F mesh events). */}
      <mesh onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} visible={false}>
        <sphereGeometry args={[7, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(encounter.status === 'pending' || encounter.status === 'active' || encounter.status === 'glowing') && (
        <LetterTracer
          letter={encounter.displayChar}
          scale={LETTER_CLOUD_SCALE}
          isNight={isNight}
          progressRef={traceProgressRef}
          onTap={handleTap}
          onTraceComplete={onTraceComplete}
          onTraceActive={onTraceActive}
          glow={encounter.status === 'glowing'}
        />
      )}
    </group>
  );
}

/**
 * The flight scene's R3F-tree half — see FlightGameScreen.tsx for the
 * DOM HUD half and the mission/queue state this is driven by. Chase
 * camera follows a point moving forward at a constant speed with a
 * slow sinusoidal bank; OceanSky renders behind it, synced to this
 * same real camera (see OceanSky.tsx); the bird sits ahead-and-below
 * the camera in frame. Flying straight into a letter-cloud is the
 * intended payoff moment (per the user) — LetterCloud's fade-on-pass
 * exists to make that read as a beat, not a glitch.
 *
 * Owns the mission clock internally (elapsed mission-seconds, paused
 * in step with forward flight) and derives `timeOfDay` from it — dawn
 * at mission start, sunset at `missionDurationSeconds`. Fires
 * `onMissionTimeUp` once when that threshold is crossed; the parent
 * decides what "time's up" means for the mission (see FlightGameScreen).
 */
export function FlightScene({
  missionDurationSeconds,
  missionProgress,
  mode,
  correctTick,
  sprintTimeAdjust,
  encounter,
  paused,
  speed = 4,
  altitude = 4,
  onTapLetter,
  onPassed,
  onFadeComplete,
  onMissionTimeUp,
  onHoverCaseSwap,
  devOcean,
  pictureChoices,
  wrongPickId,
  solvedPickId,
  onPicturePick,
  onTraceComplete,
  onTraceActive,
  lookFrozen,
  planeChallenge,
  wrongPlaneOption,
  onPlanePick,
  letterMatchup,
  wrongMatchupOption,
  onMatchupPick,
  cvcRound,
  wrongCvcIndex,
  onCvcSlotTap,
  rainbowRound,
  masteredCount = 0,
  qualityRef,
  onRainbowPassed,
  birdDistanceRef,
  stormRound,
  onStormPick,
  weather = null,
  strikeKey = 0,
}: FlightSceneProps) {
  const birdGroupRef = useRef<THREE.Group>(null);
  // CompanionFlock's own anchor — synced to the bird's POSITION only, not
  // its look-around rotation (see the useFrame block below): the flock's
  // formation offsets are large enough (a few world units, to read as a
  // trailing wedge, not a huddle) that inheriting the bird's own
  // mouse-parallax pitch/roll would swing them wildly at that radius —
  // confirmed by screenshot, an earlier version nested them directly
  // inside birdGroupRef and they ended up down near the ocean surface.
  const flockGroupRef = useRef<THREE.Group>(null);
  const [isNightIcons, setIsNightIcons] = useState(false);
  const isNightIconsRef = useRef(false);
  const lookTarget = useRef(new THREE.Vector3());
  // A real chase cam has weight — it trails the ship's sharp lateral
  // moves (route-weave, steering onto a letter's lane) by a beat
  // instead of snapping to the exact same X every frame the way the
  // bird itself does. null until the first frame so it starts exactly
  // on the bird rather than easing in from a stale 0.
  const cameraLagX = useRef<number | null>(null);
  // Smooths flightX itself — see the comment where it's used, this is
  // the fix for real, sudden jumps in the flight path (and therefore in
  // the bird's position and the camera's aim), not just mouse/camera
  // input smoothing. null until first used so it starts exactly on the
  // first frame's target rather than easing in from a stale 0.
  const flightXSmoothed = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const camera = useThree((s) => s.camera);
  // A plane challenge has no `encounter.distance` of its own to anchor
  // to (there's no encounter at all while it's active — see
  // FlightSceneProps' doc comment). distanceRef stays frozen the whole
  // time anyway (FlightGameScreen keeps `paused` true throughout), so
  // snapshotting it once when a round starts — identity-keyed on the
  // planeChallenge object itself, not every render — is enough to place
  // the planes a fixed distance ahead and have them hold still there.
  const planeChallengeDistance = useMemo(() => distanceRef.current + SPECIAL_ROUND_DISTANCE_AHEAD, [planeChallenge]);
  // Same reasoning as planeChallengeDistance above, for the letter-matchup round.
  const letterMatchupDistance = useMemo(() => distanceRef.current + SPECIAL_ROUND_DISTANCE_AHEAD, [letterMatchup]);
  // Same reasoning again, for the CVC round — keyed on `id`, not the
  // whole object, since `nextIndex` changes on every correct tap within
  // the SAME round and must not re-anchor the position each time.
  const cvcRoundDistance = useMemo(() => distanceRef.current + SPECIAL_ROUND_DISTANCE_AHEAD, [cvcRound?.id]);
  // Keyed on glowIndex, not the object — `solved` flipping mid-round must
  // not re-anchor it (it goes undefined between rounds, so a repeat
  // colour still re-anchors). Far out on the horizon, the way a real
  // rainbow sits, centred just under the waterline so its feet sink
  // into the sea and the reflection meets them.
  const rainbowCenter = useMemo<[number, number, number] | null>(
    () => (rainbowRound ? [camera.position.x, RAINBOW_CENTER_Y, camera.position.z - RAINBOW_DISTANCE_AHEAD] : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rainbowRound?.glowIndex],
  );
  const missionElapsedRef = useRef(0);
  const timeUpFiredRef = useRef(false);
  // Set once the mode's own day-arc condition is first met; from then on
  // the clock holds at NIGHT and only the extension timer below runs.
  const dayPhaseCompleteRef = useRef(false);
  const nightExtensionElapsedRef = useRef(0);
  // The sky shader already goes fully dark on its own (oceanSky.ts), but
  // these two lights are what actually shade the bird/clouds/icons —
  // fixed intensities meant those stayed just as bright at midnight as
  // at noon. Dimmed in useFrame below, off the same displayedTimeOfDay
  // the sky itself already eases toward, so the two never disagree.
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  // 0 by day, 1 in deep night — the same factor that dims the lights,
  // shared with the (unlit, MeshBasicMaterial) letter cloud so it cools
  // toward moonlight instead of staying noon-white all night.
  const nightDimRef = useRef(0);
  // 0..1 "how much are we lining up on the current cloud" — eased so the
  // camera's lift toward a letter doesn't jump when one resolves and the
  // next spawns.
  const approachSmoothed = useRef(0);
  const oceanTimeOfDayRef = useRef(DAWN);
  // The displayed time-of-day eases toward its target rather than
  // snapping to it — `missionProgress` advances in discrete per-letter
  // steps (0/6, 1/6, 2/6...), and without this, resolving a letter would
  // pop the sky instantly forward. Easing turns that into a quick,
  // visible "time-lapse" glide instead, whether the letter was answered
  // right or wrong (any resolution advances the round the same way).
  const displayedTimeOfDay = useRef(DAWN);
  // A different gentle weave every mission (re-seeded on mount, i.e. every
  // "Take Off!"/"Fly Again") — the flight path is never a dead-straight
  // line and never the same curve twice, so a letter-cloud's fixed laneX
  // sometimes sits right on the route and sometimes well off to a side.
  const routeSeed = useRef({
    freq1: 0.07 + Math.random() * 0.05,
    freq2: 0.17 + Math.random() * 0.08,
    phase1: Math.random() * Math.PI * 2,
    phase2: Math.random() * Math.PI * 2,
    amp1: 1.1 + Math.random() * 0.7,
    amp2: 0.35 + Math.random() * 0.35,
  });

  // Mouse-look parallax — moves only where the camera LOOKS, not the
  // flight path itself, and is heavily damped ("floating in vaseline":
  // slow to catch up, never a snap) rather than following the cursor
  // directly frame-to-frame.
  const mouseTarget = useRef({ x: 0, y: 0 });
  const mouseSmoothed = useRef({ x: 0, y: 0 });
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // On a tablet a tap fires a synthetic mousemove at the touch
      // point — with the gyro driving the same target that would yank
      // the view toward wherever the child last tapped.
      if (isTiltLive()) return;
      mouseTarget.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener('mousemove', onMouseMove);
    // Tablets/phones: the device's own tilt feeds the exact same
    // look-target the mouse does on desktop (see engine/tilt.ts for the
    // axis remapping and auto-centering), so the heavily-damped
    // parallax below is shared — one feel on every input.
    const unsubscribeTilt = subscribeTilt((x, y) => {
      mouseTarget.current.x = x;
      mouseTarget.current.y = y;
    });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      unsubscribeTilt();
    };
  }, []);

  // Latest-value refs — see docs/10-flight-game.md's "two real bugs":
  // useFrame closures here can't be trusted to see fresh props/state.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const rainbowCenterRef = useRef(rainbowCenter);
  rainbowCenterRef.current = rainbowCenter;
  const onRainbowPassedRef = useRef(onRainbowPassed);
  onRainbowPassedRef.current = onRainbowPassed;
  const rainbowPassedFor = useRef<[number, number, number] | null>(null);
  // Eased, so entering/leaving the rainbow's slow-down is a glide, not a lurch.
  const speedFactorRef = useRef(1);
  const rainbowSolvedRef = useRef(false);
  // Storm weather: 0 clear … 1 full storm, dipping to STORM_CLEAR_BURST
  // (a warm sunburst) once the round is solved, then back to 0.
  const stormLevelRef = useRef(0);
  const flashRef = useRef(0);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  rainbowSolvedRef.current = !!rainbowRound?.solved;
  // 0..1 — how far into the post-answer dash; drives FOV kick + blur.
  const dashRef = useRef(0);
  const blurRef = useRef(0);
  // 0 = normal chase cam, 1 = drone shot; linear here, eased where used.
  const droneRef = useRef(0);
  // The eased drone blend, shared with OceanSky's truePitchRef.
  const droneEasedRef = useRef(0);
  const skimLinear = useRef(0);
  const skimPrev = useRef(0);
  const glideRef = useRef(0);
  const dip = useRef({ t: -1, fired: false, wait: DIP_GAP_MIN });
  const skimState = useRef<SkimState>({ intensity: 0, body: new THREE.Vector3(), tips: [new THREE.Vector3(), new THREE.Vector3()], bursts: 0, nightDim: 0, speed: 1 });
  const dronePos = useRef(new THREE.Vector3()).current;
  const droneLook = useRef(new THREE.Vector3()).current;
  const lookFrozenRef = useRef(lookFrozen);
  lookFrozenRef.current = lookFrozen;
  const encounterRef = useRef(encounter);
  encounterRef.current = encounter;
  const devOceanRef = useRef(devOcean);
  devOceanRef.current = devOcean;
  // Keyed by `distance` (unique per spawn), not `canonicalLetter` — the
  // same repeated-letter identity bug as the EncounterCloud `key` above:
  // endless mode can spawn the same letter twice in a row, and a
  // letter-keyed guard would then think a brand-new encounter was
  // "already passed" the moment it spawned, permanently blocking the
  // fly-through fade for that encounter.
  const alreadyPassedRef = useRef<Set<number>>(new Set());
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;
  const onMissionTimeUpRef = useRef(onMissionTimeUp);
  onMissionTimeUpRef.current = onMissionTimeUp;
  const missionProgressRef = useRef(missionProgress);
  missionProgressRef.current = missionProgress;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const correctTickRef = useRef(correctTick);
  correctTickRef.current = correctTick;
  const sprintTimeAdjustRef = useRef(sprintTimeAdjust);
  sprintTimeAdjustRef.current = sprintTimeAdjust;
  // Seconds of sprint time left — starts at the full mission length and
  // only ever moves from real elapsed time (ticking down) and the +3/-2
  // adjustments above (see the mode==='sprint' branch in useFrame).
  const sprintRemainingRef = useRef(missionDurationSeconds);
  const lastSprintAdjustRef = useRef(0);

  useFrame(({ camera, clock }, delta) => {
    // Default Euler order ('XYZ') couples yaw and pitch: decomposing a
    // pure lookAt() orientation (genuine yaw+pitch, no intentional
    // roll) into XYZ angles can produce a nonzero Z component purely as
    // a decomposition artifact — Three's rendering of the real 3D scene
    // doesn't care (it uses the quaternion directly), but OceanSky.tsx
    // feeds that decomposed camera.rotation.z straight to the shader as
    // "roll", which then visibly tilted the horizon even after every
    // explicit roll term below was removed. 'YXZ' (yaw first, then
    // pitch around the already-yawed local X, then roll) is the
    // standard convention for exactly this "look around without
    // unwanted roll" case — decouples them properly. Confirmed by
    // screenshot, not just by the theory.
    camera.rotation.order = 'YXZ';

    const stormTarget = weatherRef.current === 'storm' ? 1 : weatherRef.current === 'clearing' ? STORM_CLEAR_BURST : 0;
    stormLevelRef.current += (stormTarget - stormLevelRef.current) * (1 - Math.exp(-STORM_EASE * delta));
    const targetSpeedFactor = rainbowCenterRef.current
      ? rainbowSolvedRef.current
        ? RAINBOW_DASH_FACTOR
        : RAINBOW_SPEED_FACTOR
      : weatherRef.current === 'storm'
        ? STORM_SPEED_FACTOR
        : 1;
    // Faster easing than a plain glide so the dash kicks in (and bleeds off after the arch) with some punch.
    speedFactorRef.current += (targetSpeedFactor - speedFactorRef.current) * (1 - Math.exp(-2.6 * delta));
    dashRef.current = THREE.MathUtils.clamp((speedFactorRef.current - 1) / (RAINBOW_DASH_FACTOR - 1), 0, 1);
    blurRef.current = dashRef.current * DASH_BLUR;
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = BASE_FOV + DASH_FOV_KICK * dashRef.current;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    if (!pausedRef.current) {
      distanceRef.current += delta * speed * speedFactorRef.current;
      missionElapsedRef.current += delta;
    }
    if (birdDistanceRef) birdDistanceRef.current = distanceRef.current;
    const rc = rainbowCenterRef.current;
    if (rc && rainbowPassedFor.current !== rc && camera.position.z < rc[2]) {
      rainbowPassedFor.current = rc;
      onRainbowPassedRef.current?.(distanceRef.current);
    }

    let frac: number;
    let missionShouldEnd = false;
    // Snapshot at the top of the frame — the day-arc branches below can
    // flip dayPhaseCompleteRef.current mid-frame (the moment the day arc
    // finishes), and that transition needs different handling (below)
    // than "we were already in the night extension."
    const wasDayPhaseComplete = dayPhaseCompleteRef.current;
    if (wasDayPhaseComplete) {
      // Night extension — a quarter of the mission's own configured
      // length, played entirely at NIGHT (day_blend is already fully 0
      // there per oceanSky.ts, so the moon is already the only light in
      // the sky; holding here instead of continuing to advance the
      // clock keeps that consistent for the whole stretch rather than
      // drifting through more sky states). Real elapsed time only —
      // none of the day arc's per-mode rewind/adjust mechanics apply to
      // it, the same fixed coda regardless of which mode got you here.
      if (!pausedRef.current) nightExtensionElapsedRef.current += delta;
      const nightExtensionSeconds = missionDurationSeconds * NIGHT_EXTENSION_FRACTION;
      frac = 1;
      missionShouldEnd = nightExtensionElapsedRef.current >= nightExtensionSeconds;
    } else if (modeRef.current === 'endless') {
      // The clock always creeps toward night, but every correct answer
      // rewinds it — accuracy directly buys more playtime, "postponing"
      // night rather than the round having a fixed length. Base pace
      // reuses the same parent-configurable mission-length setting so
      // "Flight Length" means one consistent thing across both modes.
      const rewindSeconds = missionDurationSeconds * 0.15;
      const effectiveElapsed = Math.max(0, missionElapsedRef.current - correctTickRef.current * rewindSeconds);
      frac = Math.min(1, effectiveElapsed / missionDurationSeconds);
      missionShouldEnd = frac >= 1;
    } else if (modeRef.current === 'sprint') {
      // A fixed time budget that only moves from real elapsed time and
      // explicit +3 (bonus solve) / -2 (missed self-report) adjustments
      // — see sprintTimeAdjust's doc comment. Applying the adjustment as
      // a delta against the last value seen (rather than trusting the
      // prop directly) means a burst of several bonuses/mistakes between
      // renders is never dropped or double-applied.
      const adjustDelta = sprintTimeAdjustRef.current - lastSprintAdjustRef.current;
      if (adjustDelta !== 0) {
        sprintRemainingRef.current += adjustDelta;
        lastSprintAdjustRef.current = sprintTimeAdjustRef.current;
      }
      if (!pausedRef.current) sprintRemainingRef.current -= delta;
      const remaining = Math.max(0, sprintRemainingRef.current);
      // A mistake's -2 makes the sun visibly leap toward night right
      // then, not just quietly shorten the mission — that immediate,
      // visible consequence is the whole point of the mode.
      frac = Math.min(1, 1 - remaining / missionDurationSeconds);
      missionShouldEnd = remaining <= 0;
    } else {
      const timeFrac = Math.min(1, missionElapsedRef.current / missionDurationSeconds);
      // The sky arc tracks whichever is further along: real elapsed
      // time, or how far through the round of letters the child already
      // is. Time alone meant a quick round (the keyboard/picture bonuses
      // can clear all 6 letters in well under a minute) never got the
      // sky past "afternoon" — the moon/stars the shader already
      // renders (see oceanSky.ts's getSkyColor) were technically
      // reachable, just never actually reached in normal play.
      frac = Math.max(timeFrac, missionProgressRef.current);
      missionShouldEnd = timeFrac >= 1;
    }

    // The day arc just finished this frame — hand off to the night
    // extension instead of ending the mission outright. `frac` is
    // already 1 (whichever branch above set it), so the clock holds at
    // NIGHT without any visible jump; only what happens next changes.
    if (!wasDayPhaseComplete && missionShouldEnd) {
      dayPhaseCompleteRef.current = true;
      missionShouldEnd = false;
    }

    const targetTimeOfDay = DAWN + frac * (NIGHT - DAWN);
    // Ease toward the target rather than snapping — resolving a letter
    // (right or wrong) can jump `missionProgress` a full 1/6 step in a
    // single frame; this turns that into a quick, visible time-lapse
    // glide across ~2-3 seconds instead of an instant pop. Runs even
    // while paused, since the target itself only moves from mission
    // progress in that case, not elapsed time.
    const timeLapseEase = 1 - Math.exp(-1.0 * delta);
    displayedTimeOfDay.current += (targetTimeOfDay - displayedTimeOfDay.current) * timeLapseEase;
    oceanTimeOfDayRef.current = displayedTimeOfDay.current;

    // Only touches React state on the rare frame this actually flips —
    // the picture-choice icons' day/night render mode, not a per-frame value.
    const nightNow = displayedTimeOfDay.current > NIGHT_ICON_THRESHOLD;
    if (nightNow !== isNightIconsRef.current) {
      isNightIconsRef.current = nightNow;
      setIsNightIcons(nightNow);
    }

    // 0 at full daylight, 1 by the time the sky itself has gone fully
    // dark (day_blend bottoms out at 0 by t=22 in oceanSky.ts's own sun
    // math) — dims the bird/clouds/icons in step with the sky behind
    // them instead of leaving them lit like midday all through the
    // night extension.
    const nightDim = THREE.MathUtils.clamp((displayedTimeOfDay.current - 17) / 5, 0, 1);
    nightDimRef.current = nightDim;
    // The storm dims the lights on the bird/cards too (not just the painted
    // sky), and each lightning flash briefly lights everything up.
    const stormDim = 1 - 0.45 * Math.max(0, stormLevelRef.current);
    const flash = flashRef.current * 1.4;
    if (ambientLightRef.current) ambientLightRef.current.intensity = THREE.MathUtils.lerp(0.7, 0.22, nightDim) * stormDim + flash;
    if (directionalLightRef.current) directionalLightRef.current.intensity = THREE.MathUtils.lerp(1.3, 0.3, nightDim) * stormDim + flash;

    if (!pausedRef.current) {
      if (missionShouldEnd && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        onMissionTimeUpRef.current();
      }
    }

    const distance = distanceRef.current;
    const worldZ = -distance;
    // Bank/bob/route are all tied to flight distance rather than
    // wall-clock time, so pausing for an interaction genuinely freezes
    // the whole rig, not just forward progress.
    const t = distance / speed;
    const bob = Math.sin(t * 0.5) * 0.15;

    // A slow, never-repeating-within-a-mission lateral drift — the route
    // itself, not just the letter's lane offset, wanders a little so the
    // flight never reads as a rail-straight line to each cloud.
    const seed = routeSeed.current;
    const routeX = Math.sin(t * seed.freq1 + seed.phase1) * seed.amp1 + Math.sin(t * seed.freq2 + seed.phase2) * seed.amp2;
    const routeVelocity =
      seed.amp1 * seed.freq1 * Math.cos(t * seed.freq1 + seed.phase1) + seed.amp2 * seed.freq2 * Math.cos(t * seed.freq2 + seed.phase2);
    // Coefficients here were originally 0.05/0.4, which combined with
    // mouseRoll below to swing up to ~25° at once — reported (correctly)
    // as "the horizon is very tilted", since that's well past a gentle
    // bank into looking like the world itself is crooked. Scaled down
    // roughly 3x so the worst case lands under ~10°.
    const bank = Math.sin(t * 0.35) * 0.03 + routeVelocity * 0.12;

    // Steer the free weave onto the cloud's actual lane as it's
    // approached — the cloud itself never moves (fixed at
    // [enc.laneX, altitude+2.5, -enc.distance]), so blending the flight
    // path's X onto that same laneX the closer we get makes it read as
    // "the bird is flying to that letter", not "a wandering path that
    // happens to pass near it". Both bird and camera use this, so the
    // cloud visibly settles into view rather than sliding around.
    const enc = encounterRef.current;
    let flightXTarget = routeX;
    let approachTarget = 0;
    if (enc && enc.status !== 'gone') {
      const distanceToTarget = enc.distance - distance;
      const STEER_RANGE = 26;
      const steerAmount = THREE.MathUtils.clamp(1 - distanceToTarget / STEER_RANGE, 0, 1);
      flightXTarget = THREE.MathUtils.lerp(routeX, enc.laneX, steerAmount);
      // Only lift the gaze while the cloud is still ahead — once it's
      // behind the bird (passed/fading) the camera settles back level.
      if (distanceToTarget > -PASS_BUFFER && enc.status !== 'passed') approachTarget = steerAmount;
    }
    const approachEase = 1 - Math.exp(-2.0 * delta);
    approachSmoothed.current += (approachTarget - approachSmoothed.current) * approachEase;
    // steerAmount is smooth within one encounter's whole approach, but
    // the moment an encounter resolves and the next one spawns, this
    // target itself has no relation to the previous one — one frame
    // it's basically the old letter's laneX, the next it's back to
    // wherever the bare weave curve happens to be, an instant step with
    // nothing smoothing across the seam. That's the actual "hop" this
    // is about: not a mouse/camera easing gap, a real discontinuity in
    // the flight path itself, which both the bird's position and the
    // camera's look target read directly off `flightX` every frame.
    // Easing the final value (not just each contributor to it)
    // absorbs a jump from ANY cause the same way, whatever it turns
    // out to be, rather than chasing this one source specifically.
    if (flightXSmoothed.current === null) flightXSmoothed.current = flightXTarget;
    const flightXEase = 1 - Math.exp(-2.2 * delta);
    flightXSmoothed.current += (flightXTarget - flightXSmoothed.current) * flightXEase;
    const flightX = flightXSmoothed.current;

    // Critically-damped ease toward the latest mouse position — frame-rate
    // independent (uses delta, not a fixed per-frame step), and slow
    // enough that it reads as a gentle drift rather than tracking the
    // cursor ("floating in vaseline", per the user).
    // Held still while a trace is in progress: on a tablet the act of
    // drawing wobbles the device, and the gyro would otherwise nudge the
    // very letter the child is trying to trace.
    if (!lookFrozenRef.current) {
      const parallaxEase = 1 - Math.exp(-1.4 * delta);
      mouseSmoothed.current.x += (mouseTarget.current.x - mouseSmoothed.current.x) * parallaxEase;
      mouseSmoothed.current.y += (mouseTarget.current.y - mouseSmoothed.current.y) * parallaxEase;
    }
    const mouseX = mouseSmoothed.current.x;
    const mouseY = mouseSmoothed.current.y;

    const mouseRoll = mouseX * 0.07;
    const totalRoll = bank + mouseRoll;

    // --- the rainbow skim (see SKIM_* above) ---
    const now = clock.getElapsedTime();
    skimLinear.current = THREE.MathUtils.clamp(skimLinear.current + (rainbowCenterRef.current ? 1 : -1) * (delta / SKIM_BLEND_SECONDS), 0, 1);
    const skim = THREE.MathUtils.smootherstep(skimLinear.current, 0, 1);
    // + while diving in, − while climbing out: pitches the nose into it.
    const skimVel = delta > 0 ? (skim - skimPrev.current) / delta : 0;
    skimPrev.current = skim;
    glideRef.current = THREE.MathUtils.smoothstep(skim, 0.15, 0.7);
    // Comic belly-dip: down, SQUASH on the water, sploosh, hop up past
    // the skim line, settle. Only once fully skimming, never mid-dive.
    const d = dip.current;
    let dipY = 0;
    let squash = 0;
    // No belly-dips mid-dash — it's a straight, fast run at the arch.
    if (skim > 0.97 && !pausedRef.current && dashRef.current < 0.2) {
      d.wait -= delta;
      if (d.t < 0 && d.wait <= 0) {
        d.t = 0;
        d.fired = false;
      }
    }
    if (d.t >= 0) {
      d.t += delta / DIP_SECONDS;
      const p = Math.min(d.t, 1);
      if (p < 0.5) dipY = -DIP_DEPTH * Math.sin(Math.PI * p);
      else {
        const q = (p - 0.5) / 0.5;
        dipY = -DIP_DEPTH * (1 - q) * (1 - q) + 0.45 * DIP_DEPTH * Math.sin(Math.PI * q);
      }
      squash = Math.exp(-(((p - 0.5) / 0.07) ** 2));
      if (!d.fired && p >= 0.5) {
        d.fired = true;
        skimState.current.bursts += 1;
        sfx.play('splash');
      }
      if (d.t >= 1) {
        d.t = -1;
        d.wait = DIP_GAP_MIN + Math.random() * (DIP_GAP_MAX - DIP_GAP_MIN);
      }
    }
    if (skim === 0) {
      d.t = -1;
      d.wait = DIP_GAP_MIN;
    }
    // Base height every other consumer (camera, flock) follows — no dip/bob jitter.
    const baseY = THREE.MathUtils.lerp(altitude, SKIM_Y, skim);
    const birdY = baseY + bob * (1 - skim) + skim * Math.sin(now * 1.7) * 0.06 + dipY;
    const skimBank = Math.sin(now * Math.PI * 2 * SKIM_BANK_HZ) * SKIM_BANK * (1 - squash);

    if (birdGroupRef.current) {
      birdGroupRef.current.position.set(flightX, birdY, worldZ);
      // The bird's own attitude shares the same parallax input as the
      // camera's look-around (yaw/pitch below) — reads as one connected
      // viewing angle turning together, not a flat camera pan over a
      // static model. Roll (banking) is bird-only, see above.
      birdGroupRef.current.rotation.y = mouseX * 0.16 * (1 - skim);
      birdGroupRef.current.rotation.x = mouseY * 0.08 * (1 - skim) - THREE.MathUtils.clamp(skimVel * 0.9, -0.35, 0.35) - dipY * 0.35;
      birdGroupRef.current.rotation.z = THREE.MathUtils.lerp(totalRoll * 1.4, skimBank, skim);
      birdGroupRef.current.scale.set(1 + 0.12 * squash, 1 - 0.22 * squash, 1 + 0.12 * squash);

      const st = skimState.current;
      st.intensity = skim;
      st.nightDim = nightDimRef.current;
      st.speed = speedFactorRef.current;
      birdGroupRef.current.updateMatrixWorld();
      st.body.set(flightX, birdY, worldZ);
      birdGroupRef.current.localToWorld(st.tips[0].set(-WING_TIP_LOCAL, 0, 0));
      birdGroupRef.current.localToWorld(st.tips[1].set(WING_TIP_LOCAL, 0, 0));
    }
    if (flockGroupRef.current) {
      // The companions keep a little height rather than following the bird into the sea.
      flockGroupRef.current.position.set(flightX, baseY + bob + skim * 1.1, worldZ);
    }

    // The camera's horizontal aim (yaw, i.e. panning left/right) still
    // never follows the mouse — that's what swung the fixed-in-world-
    // space letter (EncounterCloud sits at [enc.laneX, altitude+2.5,
    // -enc.distance], never touched by mouse input) across the frame,
    // which is what the "don't move the letter" request was about.
    // Pitch (up/down) and roll are a different thing: those move the
    // horizon without translating the letter meaningfully off its own
    // spot, and their total absence was its own complaint — with the
    // camera perfectly rigid, the bird's own model rotating in place
    // read as a puppet pinned to a stick rather than something actually
    // banking and climbing/diving through the air.
    const cameraPitchOffset = -mouseY * 1.6; // world units added to the lookAt target's height
    // A proper chase cam (Star Fox etc.) doesn't have its own separate
    // "look around" roll — it follows whatever the ship itself is
    // actually doing, so the two read as one connected object instead
    // of a camera panning independently over a model. Deriving this
    // from totalRoll (route-weave bank + mouseRoll together, exactly
    // what drives the bird's own rotation.z below) rather than a fresh
    // mouseX term makes the camera bank WITH the bird's real attitude,
    // whatever's causing it — not just mouse input. Scaled a bit below
    // the bird's own 1.4x multiplier (see below) so the camera reads as
    // *following* the ship's lead rather than matching it exactly,
    // which is the usual chase-cam damping choice.
    const cameraRoll = totalRoll * 0.8;

    // Dev ocean/sky tuning takes the camera away from the automatic
    // flight-cam entirely — OrbitControls (below) owns it via mouse
    // drag/scroll instead, matching the original Oceanara CodePen's own
    // free-look/orbit/zoom, which the tuning panel otherwise lacked
    // (sliders only). Skipping this block is enough; OceanSky already
    // reads whatever the "real" camera is doing each frame regardless
    // of who's driving it.
    // Chase-cam weight: the camera's own lateral position trails the
    // bird's sharp moves (route-weave, steering onto a letter's lane)
    // by a beat instead of snapping to the exact same X every frame —
    // it's still AIMED at the bird's true current position below (see
    // lookTarget), so this doesn't drop the bird from frame, it just
    // makes a fast lane-change visibly swing the view a little instead
    // of teleporting the horizon along with it. That visible swing is
    // deliberate — it's what actually reads as "a camera physically
    // chasing something," per Star Fox-style chase cams.
    if (cameraLagX.current === null) cameraLagX.current = flightX;
    const lagEase = 1 - Math.exp(-3.0 * delta);
    cameraLagX.current += (flightX - cameraLagX.current) * lagEase;

    droneRef.current = THREE.MathUtils.clamp(droneRef.current + (rainbowCenterRef.current ? 1 : -1) * (delta / DRONE_BLEND_SECONDS), 0, 1);
    const drone = THREE.MathUtils.smootherstep(droneRef.current, 0, 1);
    droneEasedRef.current = drone;

    if (!devOceanRef.current) {
      camera.position.set(cameraLagX.current, baseY + 1.6, worldZ + 6);
      lookTarget.current.set(flightX, baseY + bob - 0.2 + cameraPitchOffset + approachSmoothed.current * APPROACH_LOOK_LIFT, worldZ - 4);
      if (drone > 0) {
        const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1.5;
        const side = DRONE_SIDE * THREE.MathUtils.clamp((aspect - 0.3) / 1.2, 0.12, 1);
        dronePos.set(cameraLagX.current + side, baseY + DRONE_UP, worldZ + DRONE_BACK);
        // Aimed well ahead of the bird and a touch to its side: the bird
        // sits in the lower-left of the frame, the rainbow ahead of it.
        droneLook.set(flightX + side * 0.4, baseY - DRONE_LOOK_DROP, worldZ - DRONE_LOOK_AHEAD);
        camera.position.lerp(dronePos, drone);
        lookTarget.current.lerp(droneLook, drone);
      }
      camera.lookAt(lookTarget.current);
      // Roll applied directly after lookAt(), not folded into the
      // target — lookAt() only ever produces pitch+yaw (no roll by
      // construction), so this is genuinely additive: a pure rotation
      // around the camera's own forward axis on top of wherever it's
      // already aimed. With rotation.order 'YXZ' (set above), z is the
      // innermost/last-applied axis, so this composes correctly instead
      // of fighting the pitch/yaw lookAt() just computed. Deliberately
      // NOT the same lever as the bank/mouseRoll-driven bird tilt above
      // (that stays bird-only per the "keep the horizon level during
      // normal banking" request) — this is a distinct, smaller, purely
      // mouse-driven amount, and OceanSky.tsx reads this same value back
      // (see its uCameraRotX assignment) so the sky rolls along with it
      // instead of the background staying suspiciously level under a
      // rolling foreground.
      // A drone holds itself level — the chase-cam's banking fades out with the blend.
      camera.rotateZ(cameraRoll * (1 - drone));
    }

    if (enc) {
      const past = distance > enc.distance + PASS_BUFFER;
      const eligible = enc.status === 'pending' || enc.status === 'active' || enc.status === 'answered';
      if (past && eligible && !alreadyPassedRef.current.has(enc.distance)) {
        alreadyPassedRef.current.add(enc.distance);
        onPassedRef.current(enc.canonicalLetter);
      }
    }
  });

  return (
    <>
      {devOcean && (
        // Free mouse-drag orbit + scroll-to-zoom, exactly what the
        // original Oceanara CodePen had for inspecting its scene — the
        // tuning panel's sliders alone weren't a substitute for being
        // able to actually look around. Seeded from wherever the
        // automatic flight-cam last pointed (lookTarget), so opening
        // the panel doesn't yank the view somewhere unrelated.
        <OrbitControls makeDefault target={[lookTarget.current.x, lookTarget.current.y, lookTarget.current.z]} />
      )}
      <OceanSky
        qualityRef={qualityRef}
        truePitchRef={droneEasedRef}
        stormRef={stormLevelRef}
        flashRef={flashRef}
        timeOfDayRef={devOcean ? undefined : oceanTimeOfDayRef}
        timeOfDay={devOcean?.timeOfDay}
        seaHeight={devOcean?.seaHeight}
        seaChoppy={devOcean?.seaChoppy}
        seaFreq={devOcean?.seaFreq}
        seaRipples={devOcean?.seaRipples}
        seaSpeed={devOcean?.seaSpeed}
        starIntensity={devOcean?.starIntensity}
        sunSize={devOcean?.sunSize}
        moonSize={devOcean?.moonSize}
        seaBaseColor={devOcean?.seaBaseColor}
        seaWaterColor={devOcean?.seaWaterColor}
        daySkyColor={devOcean?.daySkyColor}
        sunsetSkyColor={devOcean?.sunsetSkyColor}
        nightSkyColor={devOcean?.nightSkyColor}
        sunColor={devOcean?.sunColor}
        moonColor={devOcean?.moonColor}
        rainbow={
          rainbowRound && rainbowCenter
            ? { glowIndex: rainbowRound.glowIndex, solved: rainbowRound.solved, center: rainbowCenter, radius: RAINBOW_RADIUS, width: RAINBOW_WIDTH }
            : null
        }
      />
      <ambientLight ref={ambientLightRef} intensity={0.7} />
      <directionalLight ref={directionalLightRef} position={[6, 10, 4]} intensity={1.3} />

      <group ref={birdGroupRef}>
        <AlbatrossModel scale={2.3} glideRef={glideRef} />
      </group>
      <SkimSplash stateRef={skimState} />
      <StormWeather levelRef={stormLevelRef} flashRef={flashRef} active={weather === 'storm'} strikeKey={strikeKey} />
      {stormRound && <StormCards round={stormRound} isNight={isNightIcons} onPick={(id) => onStormPick?.(id)} />}
      <MotionBlur amountRef={blurRef} />
      <group ref={flockGroupRef}>
        <CompanionFlock masteredCount={masteredCount} />
      </group>

      {encounter && encounter.status !== 'gone' && (
        <EncounterCloud
          // Forces a fresh mount per SPAWN — without this, React reuses
          // the same LetterCloud instance across different encounters
          // (same JSX slot, no key), and its internal refs (fade
          // opacity, "have I already fired onFadeComplete") never
          // reset. Originally keyed on canonicalLetter alone, which
          // broke a second time in endless mode specifically: it picks
          // letters with replacement, so two consecutive encounters can
          // share a letter — same bug, same symptom (the cloud silently
          // never fired its completion callback, found by tracing the
          // ref lifecycle again, not guessed). `distance` is unique per
          // spawn regardless of letter repeats, so it's the correct key.
          // See docs/10-flight-game.md.
          key={encounter.distance}
          encounter={encounter}
          altitude={altitude}
          isNight={isNightIcons}
          nightDimRef={nightDimRef}
          onTap={() => onTapLetter(encounter.canonicalLetter)}
          onFadeComplete={() => onFadeComplete(encounter.canonicalLetter, distanceRef.current)}
          onHoverCaseSwap={() => onHoverCaseSwap(encounter.canonicalLetter)}
          onTraceComplete={() => onTraceComplete(encounter.canonicalLetter)}
          onTraceActive={onTraceActive}
        />
      )}

      {encounter &&
        (encounter.status === 'pending' || encounter.status === 'glowing') &&
        pictureChoices &&
        pictureChoices.map((choice, i) => {
          // Three flash cards closely framing the letter cloud: Left, Right, and Center-Top.
          // Positioned directly relative to the letter's laneX and distance so they stay
          // reliably framed inside the camera's FOV on all screens (landscape & portrait)
          // without colliding with the letter cloud.
          const SLOTS = [
            { dx: -6.8, dy: 0.4 }, // Left flank
            { dx: 6.8, dy: 0.4 },  // Right flank
            { dx: 0, dy: 4.8 },    // Center-top crown
          ];
          const slot = SLOTS[i % SLOTS.length];
          const seed = hashSeed(`${encounter.distance}:${choice.word.id}`);
          const jitterX = (seededRandom(seed + 1) - 0.5) * 0.35;
          const jitterY = (seededRandom(seed + 2) - 0.5) * 0.25;
          const jitterZ = (seededRandom(seed + 3) - 0.5) * 0.4;
          const rs = seededRandom(seed + 4);
          const x = encounter.laneX + slot.dx + jitterX;
          const y = altitude + 2.5 + slot.dy + jitterY;
          const z = -encounter.distance + jitterZ;
          const cardScale = 0.9 + rs * 0.08;
          const isRevealed = solvedPickId === choice.word.id;
          const isFading = solvedPickId !== null && !isRevealed;
          return (
            <group key={choice.word.id} position={[x, y, z]}>
              <FlashCardSky
                wordId={choice.word.id}
                isNight={isNightIcons}
                scale={cardScale}
                wrong={wrongPickId === choice.word.id}
                revealed={isRevealed}
                fading={isFading}
                onTap={() => onPicturePick?.(choice)}
              />
            </group>
          );
        })}

      {planeChallenge && (
        <group position={[0, altitude + 2.5, -planeChallengeDistance]}>
          <PlaneChoice options={planeChallenge.options} wrongOption={wrongPlaneOption} onPick={(opt) => onPlanePick?.(opt)} />
        </group>
      )}

      {letterMatchup && (
        <group position={[0, altitude + 2.5, -letterMatchupDistance]}>
          <LetterMatchup options={letterMatchup.options} wrongOption={wrongMatchupOption} nightDimRef={nightDimRef} onPick={(opt) => onMatchupPick?.(opt)} />
        </group>
      )}

      {cvcRound && (
        <group position={[0, altitude + 2.5, -cvcRoundDistance]}>
          <CvcWordRound
            letters={cvcRound.letters}
            nextIndex={cvcRound.nextIndex}
            wrongIndex={wrongCvcIndex ?? null}
            nightDimRef={nightDimRef}
            onTapSlot={(i) => onCvcSlotTap?.(i)}
          />
        </group>
      )}
    </>
  );
}
