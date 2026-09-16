import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleLetterPoints, createPuffTexture, createBubbleTexture, makePuffSeeds, type CloudPoint, type PuffSeed } from './cloudLetter';

interface LetterCloudProps {
  letter: string;
  /** World units per canvas pixel sampled. */
  scale?: number;
  /** Tailwind-ish tint — real clouds aren't pure white, warm sunset light colors them. */
  color?: string;
  opacity?: number;
  /** When true, fades to fully transparent over ~0.8s — the "flying through it" payoff. */
  fadeOut?: boolean;
  /** When true, plays the "typed it!" celebration instead: puffs swap to
   * a bubble sprite and pop outward from the glyph before dissolving.
   * Mutually exclusive with fadeOut in practice (different encounter
   * outcomes), but each is driven independently off its own prop. */
  burst?: boolean;
  /** True during the beat after a completed trace: the whole cloud brightens past white toward warm gold and swells, before `burst` takes over. Eases in over ~0.1s. */
  glow?: boolean;
  /** 'gold' once the child has answered "Knew it!" — the cloud warms to a sunlit gold as the reward, easing in over ~0.4s rather than snapping. */
  tint?: 'none' | 'gold';
  /** 0 = full daylight, 1 = deep night; read every frame (never a React prop, it changes continuously). Cools the puffs toward a moonlit blue-grey so clouds stop glowing pure white against a night sky. */
  nightDimRef?: RefObject<number>;
  onFadeComplete?: () => void;
}

const FADE_SECONDS = 0.8;
const BURST_SECONDS = 0.95;
const BURST_MAX_DELAY = 0.15;
const BURST_DISTANCE = 2.6;
const MORPH_SECONDS = 0.5;
// A brand-new cloud used to pop in at full size the instant it mounted —
// every letter simply snapped into existence. This staggers each puff's
// grow-in by its own burstDelay (the same per-puff jitter field the
// "typed it" burst already uses, just spent on the opposite end of the
// cloud's life — the two never overlap, a fresh spawn is always well
// past SPAWN_SECONDS before burst/fadeOut can fire) so the cloud reads
// as puffs of mist condensing into the glyph, not a sprite appearing.
const SPAWN_SECONDS = 0.6;
const SPAWN_ENVELOPE_SECONDS = SPAWN_SECONDS + BURST_MAX_DELAY;
// Every letter/case sampled at cloudLetter.ts's default resolution comes
// in under ~1200 puffs ('W' is the worst case at ~1190) — this needs to
// be a fixed upper bound because the morph (hover-to-swap-case, below)
// blends between two different point counts, which means the
// InstancedMesh's instance count can no longer change with the letter
// the way it used to (that recreated the whole mesh on every swap,
// which is exactly the "poof" this replaces). Unused instances beyond
// whatever the current letter needs are just scaled to zero.
const MAX_INSTANCES = 1400;

type PuffSet = { points: CloudPoint[]; seeds: PuffSeed[] };

function samplePuffSet(letter: string): PuffSet {
  const points = sampleLetterPoints(letter);
  return { points, seeds: makePuffSeeds(points) };
}

/**
 * One letter, rendered as a cluster of soft billboard puffs shaped like
 * the glyph — see cloudLetter.ts for the technique/attribution. This
 * component owns the InstancedMesh and its per-frame "breathing"
 * animation; it does not handle tap/click detection — the flight scene
 * wraps it in a raycast target.
 *
 * Fade is driven imperatively inside this component's own useFrame
 * (mutating the material directly), not via a React-state opacity prop
 * re-rendered every frame — the lesson from OceanSky's uniforms bug
 * applies generally: per-frame visual state belongs in refs/imperative
 * mutation, not render-triggered props.
 *
 * Case-swap morph: the hover-to-swap-case feature (FlightScene.tsx)
 * changes `letter` mid-life on an otherwise-idle cloud. The first cut of
 * this swapped the point set outright on the prop change, which (via a
 * squash-pulse flourish) still read as the old shape vanishing and a new
 * one popping in — not a "morph" the user asked for. This version keeps
 * the OLD point set (`fromRef`) and blends each puff toward the NEW set
 * (`toRef`) over MORPH_SECONDS: puffs present in both shapes glide from
 * their old position to their new one; a puff only the old shape had
 * shrinks away in place; a puff only the new shape needs grows in at
 * its target position. There's no meaningful 1:1 correspondence between
 * "puff i in 'D'" and "puff i in 'd'" (they're independent pixel
 * samples of two different glyphs), but for a fuzzy cloud shape that
 * doesn't matter — the aggregate motion still reads as one shape fluidly
 * reforming into the other, which is the actual goal.
 */
const DAY_COLOR = new THREE.Color('#ffffff');
const NIGHT_COLOR = new THREE.Color('#aab8d4');
const GOLD_COLOR = new THREE.Color('#ffe3a6');
const TINT_SECONDS = 0.45;

// Components above 1.0 on purpose: with tone mapping off (`flat` Canvas)
// an over-bright colour pushes the puffs' soft edges toward white — the
// closest thing to a bloom flash without a post-process pass.
const GLOW_COLOR = new THREE.Color(1.3, 1.18, 0.8);
const GLOW_EASE_SECONDS = 0.1;
const GLOW_SWELL = 0.16;

export function LetterCloud({ letter, scale = 0.045, color = '#ffffff', opacity = 0.92, fadeOut = false, burst = false, glow = false, tint = 'none', nightDimRef, onFadeComplete }: LetterCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratchColor = useMemo(() => new THREE.Color(), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const tintRef = useRef(tint);
  tintRef.current = tint;
  const tintAmount = useRef(0);
  const tintPulse = useRef(0);
  const texture = useMemo(() => createPuffTexture(), []);
  const bubbleTexture = useMemo(() => createBubbleTexture(), []);

  const fromRef = useRef<PuffSet | null>(null);
  if (!fromRef.current) fromRef.current = samplePuffSet(letter);
  const toRef = useRef<PuffSet | null>(null);
  const morphT = useRef(1); // 1 = settled on fromRef, no active morph
  const displayedLetterRef = useRef(letter);

  if (displayedLetterRef.current !== letter) {
    toRef.current = samplePuffSet(letter);
    morphT.current = 0;
    displayedLetterRef.current = letter;
  }

  const fadeOutRef = useRef(fadeOut);
  fadeOutRef.current = fadeOut;
  const burstRef = useRef(burst);
  burstRef.current = burst;
  const glowRef = useRef(glow);
  glowRef.current = glow;
  const glowAmount = useRef(0);
  const currentOpacity = useRef(opacity);
  const burstElapsed = useRef(0);
  const burstStartedRef = useRef(false);
  const completedRef = useRef(false);
  const onFadeCompleteRef = useRef(onFadeComplete);
  onFadeCompleteRef.current = onFadeComplete;
  const spawnElapsed = useRef(0);
  const spawnDoneRef = useRef(false);

  useFrame(({ clock, camera }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    if (!spawnDoneRef.current) {
      spawnElapsed.current += delta;
      if (spawnElapsed.current >= SPAWN_ENVELOPE_SECONDS) spawnDoneRef.current = true;
    }
    const overallSpawnT = spawnDoneRef.current ? 1 : Math.min(1, spawnElapsed.current / SPAWN_ENVELOPE_SECONDS);
    const overallSpawnEase = 1 - Math.pow(1 - overallSpawnT, 3);

    if (burstRef.current && !burstStartedRef.current) {
      burstStartedRef.current = true;
      const mat = materialRef.current;
      if (mat) {
        mat.map = bubbleTexture;
        mat.color.set('#eaf9ff');
        mat.needsUpdate = true;
      }
    }
    if (burstRef.current) burstElapsed.current += delta;
    const totalBurstTime = BURST_SECONDS + BURST_MAX_DELAY;

    // Colour: daylight white cooled toward moonlit blue-grey by the
    // scene's night factor, then warmed toward gold once answered
    // correctly. The burst mode owns the material colour itself (it
    // swaps to the bubble sprite), so this only runs outside a burst.
    if (!burstRef.current && materialRef.current) {
      const dim = nightDimRef?.current ?? 0;
      const wantTint = tintRef.current === 'gold' ? 1 : 0;
      if (wantTint > tintAmount.current) tintPulse.current = Math.min(1, tintPulse.current + delta / TINT_SECONDS);
      tintAmount.current += (wantTint - tintAmount.current) * Math.min(1, delta / TINT_SECONDS);
      const wantGlow = glowRef.current ? 1 : 0;
      glowAmount.current += (wantGlow - glowAmount.current) * Math.min(1, delta / GLOW_EASE_SECONDS);
      scratchColor.copy(DAY_COLOR).lerp(NIGHT_COLOR, dim).multiply(baseColor).lerp(GOLD_COLOR, tintAmount.current).lerp(GLOW_COLOR, glowAmount.current);
      materialRef.current.color.copy(scratchColor);
    }
    const glowSwell = 1 + glowAmount.current * GLOW_SWELL;
    // A single soft swell of the whole cloud when the gold tint lands —
    // the in-world "yes!" beat, paired with the HUD's own feedback.
    const goldSwell = tintPulse.current > 0 && tintPulse.current < 1 ? 1 + Math.sin(tintPulse.current * Math.PI) * 0.12 : 1;

    // A morph never actually overlaps a burst/fade in practice (the
    // hover-swap that starts one only fires while the encounter is
    // still 'pending', burst/fadeOut only ever start once it's past
    // that) but guarding here anyway means a morph in flight just holds
    // its current blend rather than fighting the terminal animation.
    if (toRef.current && morphT.current < 1 && !burstRef.current && !fadeOutRef.current) {
      morphT.current = Math.min(1, morphT.current + delta / MORPH_SECONDS);
      if (morphT.current >= 1) {
        fromRef.current = toRef.current;
        toRef.current = null;
      }
    }

    const from = fromRef.current!;
    const to = toRef.current;
    const morphing = to !== null;
    const morphEase = morphing ? 1 - Math.pow(1 - morphT.current, 3) : 1; // ease-out cubic

    for (let i = 0; i < MAX_INSTANCES; i++) {
      const hasFrom = i < from.points.length;
      const hasTo = morphing && i < to!.points.length;
      if (!hasFrom && !hasTo) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const s = hasFrom ? from.seeds[i] : to!.seeds[i];
      const breathe = s.maxScale * (0.88 + 0.12 * Math.sin(t * s.speed + s.phase));
      let spawnEase = 1;
      if (!spawnDoneRef.current) {
        const spawnLocalT = Math.min(1, Math.max(0, (spawnElapsed.current - s.burstDelay) / SPAWN_SECONDS));
        spawnEase = 1 - Math.pow(1 - spawnLocalT, 3);
      }
      // Per-puff drift, in the same raw-sample-pixel space as the point
      // coordinates so it scales with letter size like everything else
      // here. Small relative to the 4px sampling grid (cloudLetter.ts)
      // — enough to read as a living, faintly churning cloud edge
      // rather than a static decal, not enough to blur the glyph.
      // Deliberately different frequency/phase combinations from the
      // breathing pulse above (and from each other) so puffs don't all
      // move in lockstep.
      const driftX = Math.sin(t * s.speed * 0.6 + s.phase) * 2.4;
      const driftY = Math.cos(t * s.speed * 0.45 + s.phase * 1.7) * 2.4;
      const driftZ = Math.sin(t * s.speed * 0.3 + s.phase * 2.3) * 0.1;

      if (burstRef.current) {
        const p = from.points[i];
        const localT = Math.min(1, Math.max(0, (burstElapsed.current - s.burstDelay) / BURST_SECONDS));
        const eased = 1 - (1 - localT) * (1 - localT);
        const pop = localT < 0.35 ? 1 + (localT / 0.35) * 0.3 : 1.3 * (1 - (localT - 0.35) / 0.65);
        dummy.position.set(
          (p.x + driftX) * scale + s.burstDirX * eased * BURST_DISTANCE,
          (p.y + driftY) * scale + s.burstDirY * eased * BURST_DISTANCE,
          s.depthJitter + driftZ,
        );
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotation.z += s.rotation + s.burstSpin * eased;
        dummy.scale.setScalar(Math.max(0, breathe * scale * 26 * pop));
      } else if (hasFrom && hasTo) {
        const fp = from.points[i];
        const tp = to!.points[i];
        const bx = fp.x + (tp.x - fp.x) * morphEase;
        const by = fp.y + (tp.y - fp.y) * morphEase;
        dummy.position.set((bx + driftX) * scale, (by + driftY) * scale, s.depthJitter + driftZ);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotation.z += s.rotation;
        dummy.scale.setScalar(breathe * scale * 26 * goldSwell * glowSwell * spawnEase);
      } else if (hasFrom) {
        const p = from.points[i];
        dummy.position.set((p.x + driftX) * scale, (p.y + driftY) * scale, s.depthJitter + driftZ);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotation.z += s.rotation;
        dummy.scale.setScalar(breathe * scale * 26 * (morphing ? 1 - morphEase : 1) * goldSwell * glowSwell * spawnEase);
      } else {
        const p = to!.points[i];
        dummy.position.set((p.x + driftX) * scale, (p.y + driftY) * scale, s.depthJitter + driftZ);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotation.z += s.rotation;
        dummy.scale.setScalar(breathe * scale * 26 * morphEase * goldSwell * glowSwell * spawnEase);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (burstRef.current) {
      currentOpacity.current = Math.max(0, opacity * (1 - burstElapsed.current / totalBurstTime));
      if (materialRef.current) materialRef.current.opacity = currentOpacity.current;
      if (burstElapsed.current >= totalBurstTime && !completedRef.current) {
        completedRef.current = true;
        onFadeCompleteRef.current?.();
      }
    } else if (fadeOutRef.current) {
      currentOpacity.current = Math.max(0, currentOpacity.current - delta / FADE_SECONDS);
      if (materialRef.current) materialRef.current.opacity = currentOpacity.current;
      if (currentOpacity.current <= 0 && !completedRef.current) {
        completedRef.current = true;
        onFadeCompleteRef.current?.();
      }
    } else if (materialRef.current) {
      // Fully opaque at the peak of the glow — the flash reads as solid light, not a brighter mist.
      materialRef.current.opacity = (opacity + (1 - opacity) * glowAmount.current) * overallSpawnEase;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_INSTANCES]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={materialRef} map={texture} color={color} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  );
}
