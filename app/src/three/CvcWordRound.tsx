import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { LetterCloud } from './LetterCloud';

export interface CvcWordRoundProps {
  /** The word's 3 letters, shown left to right in reading order. */
  letters: [string, string, string];
  /** Index (0-2) of the next letter that must be tapped — everything before it is already locked in. */
  nextIndex: number;
  /** Index just tapped out of turn — shakes that slot, then clears. Not the same as "wrong letter": there IS no wrong letter here, only wrong ORDER. */
  wrongIndex: number | null;
  nightDimRef: RefObject<number>;
  onTapSlot: (index: number) => void;
}

const SLOT_X = [-7, 0, 7];
const SHAKE_SECONDS = 0.4;
// Below the letters, not between letters 2-3: every word in
// data/cvcWords.ts is consonant + short-vowel + consonant, and the
// scaffold this is drawing on is "successive blending" — say the first
// two sounds together first (/k/+/æ/ → "ca"), then tack on the last one
// ("ca" + /t/ → "cat") — which always groups slots 0-1, never 1-2. Not a
// phoneme boundary (each letter here is its own phoneme; there's no
// digraph in this word list that would make two letters actually share
// one sound) — just where the blending technique itself splits the word.
//
// A flat painted arc read as a diagram, not part of the scene, and a
// first pass at fixing that (a canvas-texture star sprite — a bright
// core plus two straight crossed lines, the classic "diffraction spike"
// glyph) still read as blunt: hard, pixel-rasterized edges and a
// generic sparkle shape with nothing to do with blending specifically.
// What's here instead is a small hand-written fragment shader per
// particle — an analytic radial gradient (smoothstep, not a sampled
// texture, so the falloff stays perfectly smooth at any zoom) fading
// from a warm pale-gold core to a deeper amber edge, plus a thin,
// gently pulsing ring rather than hard spikes, for a touch of shimmer
// without looking like a generic star. Several of these leapfrog along
// the same arc on staggered phases, fading in/out at the ends for a
// seamless loop — a little procession of soft light traveling from one
// letter toward the other, with real depth from the curve's own Z bow,
// not a flat XY line.
const BLEND_SPARKLE_COUNT = 6;
const BLEND_SPARKLE_SPEED = 0.3; // cycles/second along the arc
const BLEND_SPARKLE_FADE = 0.16; // fraction of the cycle spent fading in/out at each end

const blendGlowVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const blendGlowFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0; // 0 at center, 1 at the quad's edge

    // Analytic core glow — smoothstep gives a perfectly soft falloff
    // with no banding, unlike a sampled radial-gradient texture at this
    // small an on-screen size; the extra pow() sharpens the peak a
    // little so it reads as a glint, not a soft blob.
    float core = pow(smoothstep(1.0, 0.0, d), 1.8);

    // A thin, slowly breathing ring in place of hard diffraction
    // spikes — the touch of shimmer without the blunt "star" cliche.
    float ring = smoothstep(0.1, 0.0, abs(d - 0.55)) * (0.5 + 0.5 * sin(uTime * 3.2));

    vec3 colorCore = vec3(1.0, 0.95, 0.82);
    vec3 colorEdge = vec3(0.82, 0.52, 0.32);
    vec3 color = mix(colorEdge, colorCore, core);

    float alpha = clamp(core + ring * 0.45, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

function BlendSparkles() {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(SLOT_X[0], -2.8, 0.3);
    const end = new THREE.Vector3(SLOT_X[1], -2.8, 0.3);
    // Bowed toward the camera (+Z) as well as down, not just down — a
    // pure XY arc still reads as a flat line from head-on, the angle
    // this scene is normally viewed from.
    const mid = new THREE.Vector3((SLOT_X[0] + SLOT_X[1]) / 2, -4.4, 2.4);
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, []);
  const phases = useMemo(() => Array.from({ length: BLEND_SPARKLE_COUNT }, (_, i) => i / BLEND_SPARKLE_COUNT), []);

  return (
    <group>
      {phases.map((phase, i) => (
        <BlendSparkle key={i} curve={curve} phase={phase} />
      ))}
    </group>
  );
}

function BlendSparkle({ curve, phase }: { curve: THREE.QuadraticBezierCurve3; phase: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  // Seeded once at mount — the JSX `uniforms` prop only sets initial
  // values (R3F copies them into the material's own internal uniforms
  // object at apply time, it does NOT keep this object live), so every
  // per-frame write below goes through materialRef.current.uniforms
  // instead, same gotcha OceanSky.tsx's own doc comment describes.
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 } }), []);

  useFrame(({ clock, camera }) => {
    const mesh = meshRef.current;
    const u = materialRef.current?.uniforms;
    if (!mesh || !u) return;
    const t = ((clock.getElapsedTime() * BLEND_SPARKLE_SPEED + phase) % 1 + 1) % 1;
    curve.getPoint(t, point);
    mesh.position.copy(point);
    mesh.quaternion.copy(camera.quaternion);
    const fadeIn = Math.min(1, t / BLEND_SPARKLE_FADE);
    const fadeOut = Math.min(1, (1 - t) / BLEND_SPARKLE_FADE);
    const swell = 0.75 + 0.35 * Math.sin(t * Math.PI); // a touch bigger at the arc's peak
    mesh.scale.setScalar(1.3 * swell);
    u.uOpacity.value = Math.min(fadeIn, fadeOut);
    u.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={blendGlowVertexShader}
        fragmentShader={blendGlowFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/**
 * "Catch the letters in order and blend them into a word" — the first
 * step past single-letter recognition into actual reading. Three
 * letter-clouds sit still, left to right; tapping them in order locks
 * each one in (a permanent gold tint, LetterCloud's own `tint` prop —
 * not the transient `glow` flash, which fades) and speaks that letter,
 * and completing all three speaks and celebrates the whole word. See
 * data/cvcWords.ts for the curated word list and FlightGameScreen's
 * cvcRound state for how this plugs into the mission flow (a bonus
 * interlude that doesn't consume a queue slot, closer to the writing-
 * practice interlude than to plane-choice/letter-matchup).
 */
export function CvcWordRound({ letters, nextIndex, wrongIndex, nightDimRef, onTapSlot }: CvcWordRoundProps) {
  return (
    <group>
      <BlendSparkles />
      {letters.map((letter, i) => (
        <CvcSlot
          key={i}
          letter={letter}
          x={SLOT_X[i]}
          locked={i < nextIndex}
          wrong={wrongIndex === i}
          nightDimRef={nightDimRef}
          onTap={() => onTapSlot(i)}
        />
      ))}
    </group>
  );
}

function CvcSlot({
  letter,
  x,
  locked,
  wrong,
  nightDimRef,
  onTap,
}: {
  letter: string;
  x: number;
  locked: boolean;
  wrong: boolean;
  nightDimRef: RefObject<number>;
  onTap: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const wrongRef = useRef(wrong);
  wrongRef.current = wrong;
  const shakeElapsed = useRef(0);

  useFrame((_, delta) => {
    if (wrongRef.current) shakeElapsed.current += delta;
    else shakeElapsed.current = 0;
    const st = shakeElapsed.current;
    const shakeX = st > 0 && st < SHAKE_SECONDS ? Math.sin(st * 55) * 0.3 * (1 - st / SHAKE_SECONDS) : 0;
    if (groupRef.current) groupRef.current.position.x = x + shakeX;
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onTap();
  }

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      <LetterCloud letter={letter} scale={0.05} tint={locked ? 'gold' : 'none'} nightDimRef={nightDimRef} />
      <mesh onClick={handleClick} visible={false}>
        <sphereGeometry args={[3.4, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
