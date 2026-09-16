import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pointAlong, type GuideStroke, type Pt, type TraceProgress } from '../engine/strokeGeometry';
import { createArrowTexture, createCoreTexture, createHaloTexture, createNumberTexture } from './guideTextures';

// Sizes are multiples of the cloud's `scale` (world units per sample
// pixel), so the guide scales with the letter exactly like the puffs.
const DOT_SIZE = 9;
const DOT_LIT_SIZE = 12;
const DOT_HALO_SIZE = 30;
const DOT_LIT_HALO_SIZE = 44;
const ARROW_SIZE = 30;
const ARROW_HALO_SIZE = 70;
const NUMBER_SIZE = 30;
const COMET_SIZE = 22;
const COMET_HALO_SIZE = 95;
const TAIL_COUNT = 9;
const TAIL_SPACING_PX = 7;
const MAX_DOTS = 320;
// Comet pacing — per-stroke duration scales with length but is clamped
// so a tiny stroke (an i-dot) still registers and a long S doesn't crawl.
const COMET_PX_PER_SECOND = 150;
const COMET_MIN_SECONDS = 0.55;
const COMET_MAX_SECONDS = 1.7;
const COMET_STROKE_GAP_SECONDS = 0.35;
const COMET_LOOP_PAUSE_SECONDS = 0.9;
// Strokes shorter than this (the dot on an i/j) get a start marker only.
const MIN_ARROW_LENGTH = 12;

export const GUIDE_GOLD = '#ffc94a';
export const GUIDE_GOLD_DEEP = '#ffb020';
export const GUIDE_COMET = '#fff4c2';
/** A covered checkpoint / finished stroke — near-white so "done" reads at a glance next to the gold "to do". */
export const GUIDE_LIT = '#fffbe8';

interface StrokeGuideProps {
  strokes: GuideStroke[];
  /** The tracer's scoring checkpoints, per stroke — drawn as the dashed path so what lights up is exactly what counted. */
  checkpoints: Pt[][];
  /** World units per sample pixel — must equal the sibling LetterCloud's `scale`. */
  scale: number;
  /** 0..1 read every frame — fades the comet and arrowheads (the moving parts) while the child is drawing. Dots and numbers stay: they are the progress display. */
  motionVisibilityRef: RefObject<number>;
  /** Live coverage from LetterTracer, read every frame. */
  progressRef: RefObject<TraceProgress>;
}

interface Timeline {
  /** [strokeIndex, startTime, endTime], seconds from loop start — only strokes still to do. */
  spans: [number, number, number][];
  total: number;
}

function buildTimeline(strokes: GuideStroke[], done: boolean[]): Timeline {
  const spans: [number, number, number][] = [];
  let t = 0;
  strokes.forEach((s, i) => {
    if (done[i]) return;
    const dur = Math.max(COMET_MIN_SECONDS, Math.min(COMET_MAX_SECONDS, s.length / COMET_PX_PER_SECOND));
    spans.push([i, t, t + dur]);
    t += dur + COMET_STROKE_GAP_SECONDS;
  });
  return { spans, total: t + COMET_LOOP_PAUSE_SECONDS };
}

/**
 * The "how to write it" overlay drawn onto a letter cloud: a numbered
 * start dot per stroke, a dashed golden path, an arrowhead at each
 * stroke's end, and a bright comet that traces the strokes in teaching
 * order on a loop — direction and order shown by motion, not just
 * arrows, which is what a six-year-old actually follows. Uses the same
 * stroke data the retired "watch it get written" animation used
 * (data/letterStrokes.ts), fitted onto the cloud by strokeGeometry.ts.
 *
 * It is also the progress display: the dashed dots ARE the tracer's
 * checkpoints, so each lights up the moment the finger covers it, a
 * finished stroke's number and arrowhead light up with it, and the
 * comet re-plans its loop over only the strokes still left — the child
 * always sees which parts of the letter remain.
 *
 * Everything here has depthTest off and a renderOrder above the cloud
 * (and below the child's own trail in LetterTracer.tsx): the cloud's
 * puffs are jittered in depth, so ordinary depth sorting put guide and
 * trail sprites *behind* nearby puffs — the "trace shows behind the
 * letter" bug. Explicit ordering is the only reliable fix for a pile of
 * transparent billboards.
 */
export function StrokeGuide({ strokes, checkpoints, scale, motionVisibilityRef, progressRef }: StrokeGuideProps) {
  const coreTex = useMemo(() => createCoreTexture(), []);
  const haloTex = useMemo(() => createHaloTexture(), []);
  const arrowTex = useMemo(() => createArrowTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const goldColor = useMemo(() => new THREE.Color(GUIDE_GOLD), []);
  const goldDeepColor = useMemo(() => new THREE.Color(GUIDE_GOLD_DEEP), []);
  const litColor = useMemo(() => new THREE.Color(GUIDE_LIT), []);

  // Dashed-path dots = the checkpoints, minus each stroke's first and
  // last (the start marker and arrowhead sit there). Static positions;
  // billboard orientation and lit-state are refreshed per frame.
  const dots = useMemo(() => {
    const out: { x: number; y: number; si: number; ci: number }[] = [];
    checkpoints.forEach((cps, si) => {
      if (cps.length <= 2) return;
      for (let ci = 1; ci < cps.length - 1; ci++) {
        out.push({ x: cps[ci].x, y: cps[ci].y, si, ci });
        if (out.length >= MAX_DOTS) return;
      }
    });
    return out;
  }, [checkpoints]);

  // Arrowheads. Several letters END two strokes on the same point (B and
  // D: the stem arrives at the bottom-left corner going down, the bowl
  // arrives there going left) — two overlapping arrowheads at different
  // angles rendered as one diagonal blob. A head that would land on an
  // earlier one is pulled back along its own stroke so each stays a
  // separate, correctly-pointed arrow.
  const arrows = useMemo(() => {
    const placed: { x: number; y: number; angle: number; si: number }[] = [];
    strokes.forEach((s, si) => {
      if (s.length < MIN_ARROW_LENGTH) return;
      let at = s.length;
      const collides = (x: number, y: number) => placed.some((p) => Math.hypot(p.x - x, p.y - y) < ARROW_SIZE * 0.9);
      let head = pointAlong(s, at);
      while (collides(head.x, head.y) && at > ARROW_SIZE) {
        at -= ARROW_SIZE * 0.6;
        head = pointAlong(s, at);
      }
      const back = pointAlong(s, Math.max(0, at - 8));
      placed.push({ x: head.x, y: head.y, angle: Math.atan2(head.y - back.y, head.x - back.x), si });
    });
    return placed;
  }, [strokes]);

  // Start markers. Many letters begin two strokes at the same point (B,
  // D, P, R: the stem and the bowl both start top-left) — drawn naively
  // the "2" sits exactly on the "1" and only one is visible. A marker
  // that would land on an earlier one is nudged a little way along its
  // own stroke instead, so "2" sits just into the bowl, still clearly
  // where that stroke begins.
  const starts = useMemo(() => {
    const placed: { x: number; y: number; n: number; si: number }[] = [];
    strokes.forEach((s, i) => {
      let x = s.points[0]?.x ?? 0;
      let y = s.points[0]?.y ?? 0;
      const collides = () => placed.some((p) => Math.hypot(p.x - x, p.y - y) < NUMBER_SIZE * 0.95);
      let nudge = NUMBER_SIZE * 0.9;
      while (collides() && nudge < s.length) {
        const p = pointAlong(s, nudge);
        x = p.x;
        y = p.y;
        nudge += NUMBER_SIZE * 0.5;
      }
      placed.push({ x, y, n: i + 1, si: i });
    });
    return placed;
  }, [strokes]);
  const numberTextures = useMemo(() => starts.map((s) => createNumberTexture(s.n)), [starts]);

  const dotsRef = useRef<THREE.InstancedMesh>(null);
  const dotsHaloRef = useRef<THREE.InstancedMesh>(null);
  const tailRef = useRef<THREE.InstancedMesh>(null);
  const cometCoreRef = useRef<THREE.Sprite>(null);
  const cometHaloRef = useRef<THREE.Sprite>(null);
  const arrowRefs = useRef<(THREE.Sprite | null)[]>([]);
  const arrowHaloRefs = useRef<(THREE.Sprite | null)[]>([]);
  const numberRefs = useRef<(THREE.Sprite | null)[]>([]);
  const t0 = useRef<number | null>(null);
  // The comet's loop is re-planned whenever a stroke finishes (progress.version changes).
  const timelineRef = useRef<{ version: number; timeline: Timeline } | null>(null);

  useFrame(({ clock, camera }) => {
    const now = clock.getElapsedTime();
    if (t0.current === null) t0.current = now;
    const motionVis = Math.max(0, Math.min(1, motionVisibilityRef.current ?? 1));
    const progress = progressRef.current;
    const done = progress?.done ?? [];
    const covered = progress?.covered ?? [];

    // Dashed path: lit dots grow and whiten; every dot is billboarded per frame.
    if (dotsRef.current && dotsHaloRef.current) {
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const lit = covered[d.si]?.[d.ci] === true;
        dummy.position.set(d.x * scale, d.y * scale, 0);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.setScalar((lit ? DOT_LIT_SIZE : DOT_SIZE) * scale);
        dummy.updateMatrix();
        dotsRef.current.setMatrixAt(i, dummy.matrix);
        dotsRef.current.setColorAt(i, lit ? litColor : goldColor);
        dummy.scale.setScalar((lit ? DOT_LIT_HALO_SIZE : DOT_HALO_SIZE) * scale);
        dummy.updateMatrix();
        dotsHaloRef.current.setMatrixAt(i, dummy.matrix);
        dotsHaloRef.current.setColorAt(i, lit ? litColor : goldDeepColor);
      }
      dotsRef.current.count = dots.length;
      dotsHaloRef.current.count = dots.length;
      dotsRef.current.instanceMatrix.needsUpdate = true;
      dotsHaloRef.current.instanceMatrix.needsUpdate = true;
      if (dotsRef.current.instanceColor) dotsRef.current.instanceColor.needsUpdate = true;
      if (dotsHaloRef.current.instanceColor) dotsHaloRef.current.instanceColor.needsUpdate = true;
    }

    // Arrowheads on unfinished strokes breathe gently so they read as "go
    // this way"; a finished stroke's arrow and number turn lit and still.
    const breathe = 1 + Math.sin(now * 2.6) * 0.08;
    arrows.forEach((a, i) => {
      const core = arrowRefs.current[i];
      const halo = arrowHaloRefs.current[i];
      const isDone = done[a.si] === true;
      if (core) {
        core.scale.setScalar(ARROW_SIZE * scale * (isDone ? 1 : breathe));
        const mat = core.material as THREE.SpriteMaterial;
        mat.color.copy(isDone ? litColor : goldColor);
        mat.opacity = isDone ? 1 : 0.35 + 0.65 * motionVis;
      }
      if (halo) {
        halo.scale.setScalar(ARROW_HALO_SIZE * scale * (isDone ? 1 : breathe));
        const mat = halo.material as THREE.SpriteMaterial;
        mat.color.copy(isDone ? litColor : goldDeepColor);
        mat.opacity = isDone ? 0.5 : 0.45 * motionVis;
      }
    });
    starts.forEach((s, i) => {
      const sprite = numberRefs.current[i];
      if (sprite) (sprite.material as THREE.SpriteMaterial).color.copy(done[s.si] ? litColor : goldColor);
    });

    // Comet over the strokes still to do.
    const version = progress?.version ?? 0;
    if (!timelineRef.current || timelineRef.current.version !== version) {
      timelineRef.current = { version, timeline: buildTimeline(strokes, done) };
      t0.current = now;
    }
    const timeline = timelineRef.current.timeline;
    const loopT = (now - t0.current) % timeline.total;
    let strokeIndex = -1;
    let along = 0;
    for (const [si, a, b] of timeline.spans) {
      if (loopT >= a && loopT <= b) {
        strokeIndex = si;
        const f = (loopT - a) / Math.max(0.0001, b - a);
        // ease-in-out so the comet visibly departs the start dot and settles at the arrow
        const eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        along = eased * strokes[si].length;
        break;
      }
    }
    const cometVisible = strokeIndex >= 0 && motionVis > 0.02;
    if (cometCoreRef.current) cometCoreRef.current.visible = cometVisible;
    if (cometHaloRef.current) cometHaloRef.current.visible = cometVisible;
    if (tailRef.current) tailRef.current.visible = cometVisible;
    if (cometVisible) {
      const s = strokes[strokeIndex];
      const head = pointAlong(s, along);
      const pulse = 1 + Math.sin(now * 9) * 0.1;
      if (cometCoreRef.current) {
        cometCoreRef.current.position.set(head.x * scale, head.y * scale, 0.02);
        cometCoreRef.current.scale.setScalar(COMET_SIZE * scale * pulse);
        (cometCoreRef.current.material as THREE.SpriteMaterial).opacity = motionVis;
      }
      if (cometHaloRef.current) {
        cometHaloRef.current.position.set(head.x * scale, head.y * scale, 0.01);
        cometHaloRef.current.scale.setScalar(COMET_HALO_SIZE * scale * pulse);
        (cometHaloRef.current.material as THREE.SpriteMaterial).opacity = 0.75 * motionVis;
      }
      if (tailRef.current) {
        for (let i = 0; i < TAIL_COUNT; i++) {
          const back = along - (i + 1) * TAIL_SPACING_PX;
          const p = pointAlong(s, back);
          const k = 1 - (i + 1) / (TAIL_COUNT + 1);
          const hidden = back < 0;
          dummy.position.set(p.x * scale, p.y * scale, 0.015);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.setScalar(hidden ? 0 : COMET_SIZE * scale * (0.25 + 0.75 * k));
          dummy.updateMatrix();
          tailRef.current.setMatrixAt(i, dummy.matrix);
        }
        tailRef.current.instanceMatrix.needsUpdate = true;
        (tailRef.current.material as THREE.Material).opacity = 0.85 * motionVis;
      }
    }
  });

  if (strokes.length === 0) return null;

  return (
    <group>
      {/* dashed path: additive halo under an opaque core; per-instance colour carries the lit state */}
      <instancedMesh ref={dotsHaloRef} args={[undefined, undefined, MAX_DOTS]} renderOrder={10}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={haloTex} color="#ffffff" transparent opacity={0.35} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <instancedMesh ref={dotsRef} args={[undefined, undefined, MAX_DOTS]} renderOrder={11}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={coreTex} color="#ffffff" transparent opacity={0.95} depthWrite={false} depthTest={false} />
      </instancedMesh>

      {arrows.map((a, i) => (
        <group key={`arrow-${i}`} position={[a.x * scale, a.y * scale, 0.01]}>
          <sprite ref={(el) => (arrowHaloRefs.current[i] = el)} renderOrder={12} scale={ARROW_HALO_SIZE * scale}>
            <spriteMaterial map={haloTex} color={GUIDE_GOLD_DEEP} transparent opacity={0.45} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite ref={(el) => (arrowRefs.current[i] = el)} renderOrder={13} scale={ARROW_SIZE * scale}>
            <spriteMaterial map={arrowTex} color={GUIDE_GOLD} rotation={a.angle} transparent opacity={1} depthWrite={false} depthTest={false} />
          </sprite>
        </group>
      ))}

      {starts.map((s, i) => (
        <sprite key={`start-${i}`} ref={(el) => (numberRefs.current[i] = el)} position={[s.x * scale, s.y * scale, 0.02]} renderOrder={14} scale={NUMBER_SIZE * scale}>
          <spriteMaterial map={numberTextures[i]} color={GUIDE_GOLD} transparent opacity={1} depthWrite={false} depthTest={false} />
        </sprite>
      ))}

      {/* comet: tail (instanced), halo, core */}
      <instancedMesh ref={tailRef} args={[undefined, undefined, TAIL_COUNT]} renderOrder={15}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={coreTex} color={GUIDE_GOLD} transparent opacity={0.85} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <sprite ref={cometHaloRef} renderOrder={16} scale={COMET_HALO_SIZE * scale}>
        <spriteMaterial map={haloTex} color={GUIDE_GOLD_DEEP} transparent opacity={0.75} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={cometCoreRef} renderOrder={17} scale={COMET_SIZE * scale}>
        <spriteMaterial map={coreTex} color={GUIDE_COMET} transparent opacity={1} depthWrite={false} depthTest={false} />
      </sprite>
    </group>
  );
}
