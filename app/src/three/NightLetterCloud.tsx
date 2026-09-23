import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildLetterConstellation, createStarTexture, makePuffSeeds } from './cloudLetter';
import { traceProgressFraction, type TraceProgress } from '../engine/strokeGeometry';

const STAR_COLOR = new THREE.Color('#bfe0ff');
const GOLD_STAR = new THREE.Color('#ffe3a6');
const GLOW_STAR = new THREE.Color(1.3, 1.18, 0.8);
// How wide (in progress-fraction terms) the transition band is for one
// star's own pop-in — soft enough to read as stars winking on along a
// moving front, not a hard on/off flip per star.
const REVEAL_BAND = 0.16;
const REVEAL_EASE_PER_SECOND = 3.5;
// A not-yet-reached star is still visible (so the child can see there's
// a shape to trace), just small and faint — never fully invisible. Scale
// alone turned out not to read as "dim" against an additive-blended
// sprite with a hot core (a half-size bright pinpoint still looks
// bright, confirmed by screenshot) — UNLIT_BRIGHTNESS drives a real
// per-instance color multiplier (via InstancedMesh.setColorAt) on top of
// the milder scale drop, which is what actually sells "distant/unlit".
const UNLIT_SCALE = 0.55;
const UNLIT_BRIGHTNESS = 0.3;
const STAR_MAX_OPACITY = 0.95;
const LINE_MAX_OPACITY = 0.6;

interface NightLetterCloudProps {
  letter: string;
  /** Same world-units-per-sample-pixel scale as the sibling day cloud/tracer — the constellation must line up with what LetterTracer is scoring against. */
  scale: number;
  progressRef?: RefObject<TraceProgress>;
  visible: boolean;
  /** 0..1, combining LetterCloud's spawn-in and fade-out/pass timers — see LetterCloud's nightFadeRef. */
  fadeRef: RefObject<number>;
  tintAmountRef: RefObject<number>;
  glowAmountRef: RefObject<number>;
}

/**
 * Night-time alternative to LetterCloud's day puff-cloud rendering: the
 * letter as a sparse constellation (cloudLetter.ts's
 * buildLetterConstellation — same outline-sample + minimum-spanning-tree
 * technique as NounSkyIcon's night picture-choice icons) that starts as
 * dim, unconnected stars and lights up + connects following the SAME
 * order the tree was grown in (buildMstEdges' edges are already in
 * tree-growth order — point 0 first, then each edge's `b` endpoint),
 * driven by live trace progress (progressRef, shared with LetterTracer).
 * The shape visibly forms as the child actually traces it, instead of
 * sitting there fully pre-drawn the way the day cloud does.
 *
 * Lines reveal via the geometry's drawRange (edges are already stored in
 * growth order, so "the first N edges" IS "the edges revealed so far") —
 * not per-vertex color darkening, which a first version tried: dimming a
 * LineBasicMaterial's vertex color toward black still draws a fully
 * OPAQUE black line (the material's own `opacity` is uniform for the
 * whole draw call, there's no per-vertex alpha), so every "unlit" edge
 * still showed as a dark outline of the whole letter — confirmed by
 * screenshotting an idle cloud and finding the full shape already
 * traced in dark lines despite the stars themselves correctly showing
 * only ~8 of 90 lit (verified via a temporary debug log, not guessed).
 */
export function NightLetterCloud({ letter, scale, progressRef, visible, fadeRef, tintAmountRef, glowAmountRef }: NightLetterCloudProps) {
  const constellation = useMemo(() => buildLetterConstellation(letter), [letter]);
  const seeds = useMemo(() => makePuffSeeds(constellation.points), [constellation]);
  // Reconstructs the order points joined the minimum-spanning tree: point
  // 0 first, then each edge's `b` endpoint in the order edges were added
  // (buildMstEdges already returns them in that order) — used both for
  // each star's own reveal threshold below and, implicitly, for the
  // lines: `constellation.edges` is already sorted the same way, so "the
  // first N edges" is exactly "the edges revealed so far".
  const revealThreshold = useMemo(() => {
    const n = constellation.points.length;
    const order = [0, ...constellation.edges.map((e) => e.b)];
    const rank = new Array<number>(n).fill(0);
    order.forEach((pointIndex, i) => {
      rank[pointIndex] = i;
    });
    return rank.map((r) => (n > 1 ? r / (n - 1) : 0));
  }, [constellation]);
  // A single eased scalar (not per-point) — each star's own pop-in still
  // reads as staggered because revealThreshold spreads their targets out
  // over the 0..1 range, not because each star has its own easing.
  const revealEasedRef = useRef(0);

  const texture = useMemo(() => createStarTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratchColor = useMemo(() => new THREE.Color(), []);
  const instanceColor = useMemo(() => new THREE.Color(), []);
  const starMeshRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(constellation.edges.length * 6);
    constellation.edges.forEach((e, i) => {
      const a = constellation.points[e.a];
      const b = constellation.points[e.b];
      positions[i * 6 + 0] = a.x * scale;
      positions[i * 6 + 1] = a.y * scale;
      positions[i * 6 + 2] = 0;
      positions[i * 6 + 3] = b.x * scale;
      positions[i * 6 + 4] = b.y * scale;
      positions[i * 6 + 5] = 0;
    });
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [constellation, scale]);

  useFrame(({ camera, clock }, delta) => {
    const t = clock.getElapsedTime();
    const progress = progressRef?.current ? traceProgressFraction(progressRef.current) : 0;
    revealEasedRef.current += (progress - revealEasedRef.current) * Math.min(1, delta * REVEAL_EASE_PER_SECOND);
    const reveal = revealEasedRef.current;
    const fade = fadeRef.current ?? 1;
    const tintAmount = tintAmountRef.current ?? 0;
    const glowAmount = glowAmountRef.current ?? 0;
    scratchColor.copy(STAR_COLOR).lerp(GOLD_STAR, tintAmount).lerp(GLOW_STAR, glowAmount);
    const glowSwell = 1 + glowAmount * 0.16;

    const mesh = starMeshRef.current;
    if (mesh) {
      for (let i = 0; i < constellation.points.length; i++) {
        const lit = Math.max(0, Math.min(1, (reveal - revealThreshold[i]) / REVEAL_BAND + 1));
        const p = constellation.points[i];
        const s = seeds[i];
        const twinkle = 0.7 + 0.3 * Math.sin(t * s.speed * 1.6 + s.phase);
        dummy.position.set(p.x * scale, p.y * scale, s.depthJitter * 0.3);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.setScalar(twinkle * scale * 30 * (UNLIT_SCALE + (1 - UNLIT_SCALE) * lit) * glowSwell);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, instanceColor.copy(scratchColor).multiplyScalar(UNLIT_BRIGHTNESS + (1 - UNLIT_BRIGHTNESS) * lit));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = STAR_MAX_OPACITY * fade;
    }

    const line = lineRef.current;
    if (line) {
      const revealedEdges = Math.max(0, Math.min(constellation.edges.length, Math.round(reveal * constellation.edges.length)));
      line.geometry.setDrawRange(0, revealedEdges * 2);
    }
    if (lineMaterialRef.current) {
      lineMaterialRef.current.color.copy(scratchColor);
      lineMaterialRef.current.opacity = LINE_MAX_OPACITY * fade;
    }
  });

  return (
    <group visible={visible}>
      <lineSegments ref={lineRef} geometry={lineGeometry}>
        <lineBasicMaterial ref={lineMaterialRef} transparent depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={starMeshRef} args={[undefined, undefined, Math.max(1, constellation.points.length)]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} color="#ffffff" vertexColors transparent opacity={STAR_MAX_OPACITY} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  );
}
