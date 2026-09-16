import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { checkpointsAlong, nearestStrokeIndex, type Pt, type TraceProgress } from '../engine/strokeGeometry';
import { getGuideStrokes } from './strokeFit';
import { traceActivity } from '../engine/traceActivity';
import * as sfx from '../engine/sfx';
import { createCoreTexture, createHaloTexture } from './guideTextures';
import { StrokeGuide, GUIDE_GOLD_DEEP } from './StrokeGuide';

// Scoring is per STROKE, against the same teaching-order paths the guide
// draws (engine/strokeGeometry.ts): each stroke has checkpoints spaced
// along it, a stroke counts as done once STROKE_DONE_FRACTION of its
// checkpoints have been touched, and the letter counts as traced only
// when EVERY stroke is done. An earlier version scored coverage of the
// glyph's whole footprint, which a single wide scribble could satisfy
// halfway through — a child never had to actually draw all the parts.
const CHECKPOINT_SPACING_PX = 10; // sample-px along each stroke
// Forgiving on HOW (a finger can wander this far off the centerline and
// still count) — strict on WHAT (all strokes). Half a Nunito Black stem
// is ~20px, so this reaches well past the cloud's own edge.
const TOLERANCE_PX = 34;
// Allows the odd missed checkpoint along the way — but never the ends:
// a stroke's first and last checkpoint must both be reached (with the
// tighter END_TOLERANCE_PX), otherwise the wide tolerance above lets the
// 80% mark arrive while the finger is still a third of the way from the
// stroke's end. Caught on the 'h': the arch counted as done while the
// child was still coming down its right leg, and the letter resolved
// under their finger.
const STROKE_DONE_FRACTION = 0.8;
const END_TOLERANCE_PX = 22;
const MAX_TRAIL_POINTS = 320;
const MIN_TRAIL_SPACING = 0.09; // world units between consecutive trail sprites — dense enough to read as one ribbon
// A pointer gesture under this much cumulative movement (world units) is
// a tap, not a trace attempt — mirrors the old plain-tap-to-self-report
// behavior for a child who just taps the cloud instead of drawing on it.
// A gesture that covered a checkpoint is always a trace, however short
// (dotting an i is a dab, not a tap).
const DRAG_VS_TAP_DISTANCE = 0.5;
// How close (world units, in the letter's own local frame) a pointer-down
// must land to the glyph to engage tracing/tapping at all — keeps this
// from swallowing clicks meant for the picture-choice icons floating
// below the letter cloud.
const ENGAGE_RADIUS = 6.5;
// The whole tracing layer sits this far in front of the cloud's puffs
// (which are depth-jittered ±0.3) — belt and braces alongside the
// explicit renderOrder/depthTest=false below.
const LAYER_Z = 0.9;
// Trail sprite sizes as multiples of the cloud's scale.
const TRAIL_CORE_SIZE = 24;
const TRAIL_HALO_SIZE = 64;
const TIP_CORE_SIZE = 40;
const TIP_HALO_SIZE = 130;
// How fast the guide's comet/arrows fade while the child is drawing and
// return afterwards (the dots and numbers stay — they are the progress).
const GUIDE_FADE_OUT_PER_SECOND = 4;
const GUIDE_FADE_IN_PER_SECOND = 1.2;
const GUIDE_RETURN_DELAY_SECONDS = 1.6;
const RIBBON_GLOW_EASE_SECONDS = 0.1;

const TRAIL_CORE_COLOR = '#ffd45e';
const TRAIL_TIP_COLOR = '#fff6d6';

interface LetterTracerProps {
  letter: string;
  /** World units per sampled canvas pixel — must match the sibling LetterCloud's own `scale` so the trace lines up with what's actually drawn. */
  scale: number;
  isNight: boolean;
  onTap: () => void;
  onTraceComplete: () => void;
  /** Fires true on the pointer-down that starts a trace and false on the pointer-up (or unmount) that ends it — FlightGameScreen freezes the flight around it. */
  onTraceActive?: (active: boolean) => void;
  /** The completed-trace flash: the ribbon thickens and whitens with the cloud. */
  glow?: boolean;
}

/**
 * "Trace the letter" as drawing directly onto the sky: dragging over the
 * letter cloud paints a glowing golden ribbon that follows the finger,
 * with a bright tip where the finger is. A StrokeGuide (numbered
 * starts, dashed path, arrowheads, travelling comet) shows the correct
 * stroke order and direction; its dots light up as the finger covers
 * them, a finished stroke's arrow and number light up with them, and
 * the comet only cycles over strokes still to do. The comet and arrows
 * fade while the child is actually drawing so they don't fight their
 * own hand; the dots stay, because they ARE the progress.
 *
 * Completion is strict about the parts and lenient about the manner:
 * every stroke must be traced (see the constants above), but order and
 * direction are taught by the guide, not enforced — a child who draws
 * the bowl before the stem still finishes the letter.
 *
 * Input is captured on the canvas element directly (not via R3F's
 * per-mesh pointer events) and raycast against a plane through the
 * letter's current position, facing the camera: R3F's mesh-level
 * pointer events only fire while the ray currently intersects that
 * mesh, so a fast/wide child's drag that strays off the glyph's own
 * (fairly small) hit-volume would silently stop registering moves
 * mid-trace. A camera-facing plane has no edges to fall off.
 */
export function LetterTracer({ letter, scale, isNight, onTap, onTraceComplete, onTraceActive, glow = false }: LetterTracerProps) {
  const { gl, camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const strokes = useMemo(() => getGuideStrokes(letter), [letter]);
  const checkpoints = useMemo<Pt[][]>(() => strokes.map((s) => checkpointsAlong(s, CHECKPOINT_SPACING_PX)), [strokes]);
  const progressRef = useRef<TraceProgress>({ covered: [], done: [], version: 0 });
  const completedRef = useRef(false);
  // All strokes done, but the letter only resolves once the finger LIFTS —
  // resolving mid-stroke (glow, burst, next cloud) while a child is still
  // drawing is exactly the "it advanced on me" feeling to avoid.
  const allStrokesDoneRef = useRef(false);
  // Which stroke the CURRENT continuous drag is scoring against — decided
  // ONCE, from wherever the drag actually starts, and held fixed for the
  // rest of that same drag (reset to null on every pointer-down). See the
  // long comment on registerPoint for why per-point "nearest stroke"
  // isn't enough on its own.
  const activeStrokeRef = useRef<number | null>(null);
  const trailPointsRef = useRef<THREE.Vector3[]>([]);
  // Case-swap (hover flips 'D' <-> 'd' on the SAME live encounter, see
  // EncounterCloud) changes `letter` without remounting this component —
  // reset progress (and the drawn ribbon) against the new glyph's own
  // strokes rather than keeping stale coverage of a shape that no
  // longer exists.
  useEffect(() => {
    progressRef.current = { covered: checkpoints.map((cps) => cps.map(() => false)), done: checkpoints.map(() => false), version: 0 };
    completedRef.current = false;
    allStrokesDoneRef.current = false;
    activeStrokeRef.current = null;
    trailPointsRef.current = [];
  }, [checkpoints]);

  const coreTex = useMemo(() => createCoreTexture(), []);
  const haloTex = useMemo(() => createHaloTexture(), []);
  const coreMeshRef = useRef<THREE.InstancedMesh>(null);
  const haloMeshRef = useRef<THREE.InstancedMesh>(null);
  const tipCoreRef = useRef<THREE.Sprite>(null);
  const tipHaloRef = useRef<THREE.Sprite>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const draggingRef = useRef(false);
  const lastDrawAtRef = useRef(-Infinity);
  const guideVisibilityRef = useRef(1);

  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const onTraceCompleteRef = useRef(onTraceComplete);
  onTraceCompleteRef.current = onTraceComplete;
  const onTraceActiveRef = useRef(onTraceActive);
  onTraceActiveRef.current = onTraceActive;
  const glowRef = useRef(glow);
  glowRef.current = glow;
  const glowAmount = useRef(0);
  const coreColor = useMemo(() => new THREE.Color(TRAIL_CORE_COLOR), []);
  const glowColor = useMemo(() => new THREE.Color(1.2, 1.2, 1.1), []);
  const scratchColor = useMemo(() => new THREE.Color(), []);

  /** Adds a ribbon point and scores it against every unfinished stroke. Returns true if it covered a new checkpoint. */
  function registerPoint(local: THREE.Vector3): boolean {
    const sx = local.x / scale;
    const sy = local.y / scale;

    const last = trailPointsRef.current[trailPointsRef.current.length - 1];
    if (!last || last.distanceTo(local) > MIN_TRAIL_SPACING) {
      const next = [...trailPointsRef.current, local.clone()];
      trailPointsRef.current = next.length > MAX_TRAIL_POINTS ? next.slice(next.length - MAX_TRAIL_POINTS) : next;
    }

    if (completedRef.current || allStrokesDoneRef.current) return false;
    const progress = progressRef.current;
    // Which stroke does this whole DRAG belong to? Decided once, from
    // the drag's own first point, and then held fixed — not re-decided
    // per point. A pure per-point "nearest stroke" (tried first) still
    // breaks wherever two strokes are constructed to touch or run close
    // together (a crossbar meeting the legs of an 'A', the bowl of a
    // 'd' sitting flush against its stem): AT the touch point itself,
    // distance to "my own stroke" and distance to "the stroke touching
    // me" come out within a fraction of a unit of each other — a real
    // coin flip, confirmed by instrumenting exactly this case on 'A'
    // (4.80 vs 4.64, 1.04 vs 0.93) — and once tolerance is wide enough
    // for comfortable finger-tracing, landing that flip on the WRONG
    // stroke even once is enough to sweep most of a short stroke's
    // checkpoints from a single point. Locking the whole drag to
    // whichever stroke it STARTED nearest to sidesteps the ambiguity
    // entirely: a drag that begins on the stem (nowhere near the touch
    // point) can never be reattributed mid-stroke just because it later
    // passes close to something else.
    if (activeStrokeRef.current === null) {
      activeStrokeRef.current = nearestStrokeIndex({ x: sx, y: sy }, checkpoints, (i) => !progress.done[i]);
    }
    const si = activeStrokeRef.current;
    let coveredNew = false;
    let strokeJustDone = false;
    if (si !== -1 && si !== null && !progress.done[si]) {
      const cps = checkpoints[si];
      const row = progress.covered[si];
      const lastIndex = cps.length - 1;
      let coveredCount = 0;
      for (let ci = 0; ci < cps.length; ci++) {
        if (!row[ci]) {
          const dx = cps[ci].x - sx;
          const dy = cps[ci].y - sy;
          const tol = ci === 0 || ci === lastIndex ? END_TOLERANCE_PX : TOLERANCE_PX;
          if (dx * dx + dy * dy < tol * tol) {
            row[ci] = true;
            coveredNew = true;
          }
        }
        if (row[ci]) coveredCount++;
      }
      const endsReached = row[0] && row[lastIndex];
      if (endsReached && coveredCount >= Math.ceil(cps.length * STROKE_DONE_FRACTION)) {
        progress.done[si] = true;
        strokeJustDone = true;
      }
    }
    if (coveredNew) progress.version++;
    if (strokeJustDone) {
      const allDone = progress.done.length > 0 && progress.done.every(Boolean);
      if (allDone) {
        allStrokesDoneRef.current = true; // resolved on pointer-up, see onUp
      } else {
        sfx.play('stroke');
        sfx.haptic(8);
      }
    }
    return coveredNew;
  }

  useEffect(() => {
    const dom = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane();
    const planeNormal = new THREE.Vector3();
    const worldPos = new THREE.Vector3();
    const lastLocal = new THREE.Vector3();
    let dragging = false;
    let dragDistance = 0;
    let gestureCoveredAny = false;
    let activePointerId: number | null = null;

    function ndcFromEvent(e: PointerEvent): THREE.Vector2 {
      const rect = dom.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    }

    function planeHitLocal(e: PointerEvent): THREE.Vector3 | null {
      if (!groupRef.current) return null;
      groupRef.current.getWorldPosition(worldPos);
      camera.getWorldDirection(planeNormal);
      plane.setFromNormalAndCoplanarPoint(planeNormal, worldPos);
      raycaster.setFromCamera(ndcFromEvent(e), camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      return groupRef.current.worldToLocal(hit);
    }

    function onDown(e: PointerEvent) {
      if (activePointerId !== null) return; // one finger draws; a second finger is ignored, not a new stroke
      const local = planeHitLocal(e);
      if (!local || local.length() > ENGAGE_RADIUS) return;
      activePointerId = e.pointerId;
      dragging = true;
      draggingRef.current = true;
      traceActivity.dragging = true;
      onTraceActiveRef.current?.(true);
      activeStrokeRef.current = null; // fresh drag — re-decide which stroke it's tracing
      dragDistance = 0;
      gestureCoveredAny = false;
      lastLocal.copy(local);
      // A pointer that leaves the canvas mid-drag (edge of the screen)
      // must still deliver its move/up events to us.
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        // not all environments support capture on the canvas — harmless
      }
    }
    function onMove(e: PointerEvent) {
      if (!dragging || e.pointerId !== activePointerId) return;
      const local = planeHitLocal(e);
      if (!local) return;
      dragDistance += local.distanceTo(lastLocal);
      lastLocal.copy(local);
      if (registerPoint(local)) gestureCoveredAny = true;
      lastDrawAtRef.current = performance.now();
      traceActivity.lastDrawAt = lastDrawAtRef.current;
    }
    function onUp(e: PointerEvent) {
      if (e.pointerId !== activePointerId) return;
      if (dragging && dragDistance < DRAG_VS_TAP_DISTANCE && !gestureCoveredAny) onTapRef.current();
      dragging = false;
      draggingRef.current = false;
      traceActivity.dragging = false;
      activePointerId = null;
      onTraceActiveRef.current?.(false);
      if (allStrokesDoneRef.current && !completedRef.current) {
        completedRef.current = true;
        onTraceCompleteRef.current();
      }
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        // see above
      }
    }

    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      // Unmounting mid-drag (the cloud burst under the finger) must
      // still release the flight freeze.
      if (dragging) {
        draggingRef.current = false;
        traceActivity.dragging = false;
        onTraceActiveRef.current?.(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, scale, checkpoints]);

  useFrame(({ camera: cam, clock }, delta) => {
    // Comet/arrows fade out fast while drawing, come back slowly after a pause.
    const drawingRecently = draggingRef.current || performance.now() - lastDrawAtRef.current < GUIDE_RETURN_DELAY_SECONDS * 1000;
    const target = drawingRecently || completedRef.current ? 0 : 1;
    const rate = target < guideVisibilityRef.current ? GUIDE_FADE_OUT_PER_SECOND : GUIDE_FADE_IN_PER_SECOND;
    guideVisibilityRef.current += (target - guideVisibilityRef.current) * Math.min(1, delta * rate);

    const wantGlow = glowRef.current ? 1 : 0;
    glowAmount.current += (wantGlow - glowAmount.current) * Math.min(1, delta / RIBBON_GLOW_EASE_SECONDS);
    const glowThicken = 1 + glowAmount.current * 0.5;

    const points = trailPointsRef.current;
    const core = coreMeshRef.current;
    const halo = haloMeshRef.current;
    if (core && halo) {
      const coreMat = core.material as THREE.MeshBasicMaterial;
      coreMat.color.copy(scratchColor.copy(coreColor).lerp(glowColor, glowAmount.current));
      (halo.material as THREE.MeshBasicMaterial).opacity = (isNight ? 0.6 : 0.42) + 0.5 * glowAmount.current;
      for (let i = 0; i < points.length; i++) {
        // Slight taper toward the older end so the ribbon reads as a stroke with a direction.
        const age = 1 - i / Math.max(1, points.length - 1);
        const taper = (0.75 + 0.25 * (1 - age)) * glowThicken;
        dummy.position.copy(points[i]);
        dummy.quaternion.copy(cam.quaternion);
        dummy.scale.setScalar(TRAIL_CORE_SIZE * scale * taper);
        dummy.updateMatrix();
        core.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(TRAIL_HALO_SIZE * scale * taper);
        dummy.updateMatrix();
        halo.setMatrixAt(i, dummy.matrix);
      }
      core.count = points.length;
      halo.count = points.length;
      core.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    }

    // Glowing tip at the finger while drawing (and lingering briefly after).
    const tipVisible = points.length > 0 && (draggingRef.current || performance.now() - lastDrawAtRef.current < 600);
    const tip = points[points.length - 1];
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 10) * 0.12;
    if (tipCoreRef.current) {
      tipCoreRef.current.visible = tipVisible;
      if (tip) tipCoreRef.current.position.set(tip.x, tip.y, tip.z + 0.03);
      tipCoreRef.current.scale.setScalar(TIP_CORE_SIZE * scale * pulse);
    }
    if (tipHaloRef.current) {
      tipHaloRef.current.visible = tipVisible;
      if (tip) tipHaloRef.current.position.set(tip.x, tip.y, tip.z + 0.02);
      tipHaloRef.current.scale.setScalar(TIP_HALO_SIZE * scale * pulse);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, LAYER_Z]}>
      <StrokeGuide strokes={strokes} checkpoints={checkpoints} scale={scale} motionVisibilityRef={guideVisibilityRef} progressRef={progressRef} />

      {/* the child's ribbon: additive halo under an opaque gold core, always on top of the cloud */}
      <instancedMesh ref={haloMeshRef} args={[undefined, undefined, MAX_TRAIL_POINTS]} renderOrder={20}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={haloTex} color={isNight ? '#ffd27a' : GUIDE_GOLD_DEEP} transparent opacity={isNight ? 0.6 : 0.42} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <instancedMesh ref={coreMeshRef} args={[undefined, undefined, MAX_TRAIL_POINTS]} renderOrder={21}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={coreTex} color={TRAIL_CORE_COLOR} transparent opacity={0.98} depthWrite={false} depthTest={false} />
      </instancedMesh>
      <sprite ref={tipHaloRef} renderOrder={22} visible={false}>
        <spriteMaterial map={haloTex} color={GUIDE_GOLD_DEEP} transparent opacity={0.8} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={tipCoreRef} renderOrder={23} visible={false}>
        <spriteMaterial map={coreTex} color={TRAIL_TIP_COLOR} transparent opacity={1} depthWrite={false} depthTest={false} />
      </sprite>
    </group>
  );
}
