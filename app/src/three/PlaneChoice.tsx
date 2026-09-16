import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { createPlaneTexture } from './planeTexture';

export interface PlaneChoiceProps {
  /** The three display letters (already case-matched to what this round is testing), one per plane — see FlightGameScreen's planeChallenge. Whether a given option IS the target is FlightGameScreen's own concern (it already knows the letter it just spoke); this component is a dumb renderer that just reports which one got tapped. */
  options: string[];
  /** Which option, if any, was just tapped wrong — shakes that plane, same shake language as NounSkyIcon's `wrong` prop. */
  wrongOption?: string | null;
  onPick: (option: string) => void;
}

// A friendly, non-threatening accent per plane — cycled by lane, not
// meaningful individually (the letter itself is the only thing that
// matters for the answer).
const PLANE_COLORS = ['#d94e2f', '#3f9e6d', '#3d7fb0'];
// Vertical lanes (world units, relative to the whole group's own Y) so
// planes never visually collide even when their X positions coincide —
// same reasoning as EncounterCloud/NounSkyIcon staying spatially apart.
const LANE_Y = [3.3, 0, -4.6];
// World units the flight path spans before looping back to the left
// (fully off-screen on both ends at the group's placement distance).
const SPAN = 20;
const SPEED = 0.11; // cycles/second — ~9s to cross, unhurried enough to read the letter
const FADE_EDGE = 0.1; // fraction of the cycle spent fading in/out at each end
const ROCK_SECONDS = 1.6;
const SHAKE_SECONDS = 0.4;

/**
 * "Hear the letter's name, pick the matching plane" — the reverse of
 * every other encounter path in this game (which all start from a
 * visible glyph). Three planes tow letter banners left-to-right across
 * the sky in a continuous, staggered loop; tapping the one that matches
 * the letter FlightGameScreen spoke on mount resolves the round. See
 * planeTexture.ts for the billboard art and FlightGameScreen's
 * `planeChallenge` state for how this plugs into scoring/streak/mastery
 * exactly like any other bonus solve.
 */
export function PlaneChoice({ options, wrongOption, onPick }: PlaneChoiceProps) {
  const textures = useMemo(() => options.map((opt, i) => createPlaneTexture(opt, PLANE_COLORS[i % PLANE_COLORS.length])), [options]);
  // Staggered so the three planes don't move in lockstep, and each gets
  // its own lane — order here doesn't need to match visual left-right
  // order since every plane loops through the same span regardless.
  const phases = useMemo(() => options.map((_, i) => i / options.length), [options]);

  return (
    <group>
      {options.map((opt, i) => (
        <Plane
          key={opt}
          texture={textures[i]}
          laneY={LANE_Y[i % LANE_Y.length]}
          phase={phases[i]}
          wrong={wrongOption === opt}
          onTap={() => onPick(opt)}
        />
      ))}
    </group>
  );
}

function Plane({ texture, laneY, phase, wrong, onTap }: { texture: THREE.CanvasTexture; laneY: number; phase: number; wrong: boolean; onTap: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const wrongRef = useRef(wrong);
  wrongRef.current = wrong;
  const shakeElapsed = useRef(0);

  useFrame(({ clock, camera }, delta) => {
    const t = clock.getElapsedTime();
    const cycle = ((t * SPEED + phase) % 1 + 1) % 1;
    const x = -SPAN / 2 + cycle * SPAN;
    const bob = Math.sin(t * 0.9 + phase * 6.28) * 0.3;

    if (wrongRef.current) shakeElapsed.current += delta;
    else shakeElapsed.current = 0;
    const st = shakeElapsed.current;
    const shakeX = st > 0 && st < SHAKE_SECONDS ? Math.sin(st * 55) * 0.4 * (1 - st / SHAKE_SECONDS) : 0;

    if (groupRef.current) {
      groupRef.current.position.set(x + shakeX, laneY + bob, 0);
    }
    if (meshRef.current) {
      // Billboard-face the camera, then layer a small side-to-side
      // "waving hello" rock on top — same compose-on-top-of-facing
      // technique LetterCloud uses for its own per-puff rotation.
      meshRef.current.quaternion.copy(camera.quaternion);
      meshRef.current.rotateZ(Math.sin(t * ((Math.PI * 2) / ROCK_SECONDS) + phase * 6.28) * 0.12);
      // Fade in from the left edge, fade out approaching the right —
      // a clean loop instead of an abrupt teleport-and-pop at the seam.
      const fadeIn = Math.min(1, cycle / FADE_EDGE);
      const fadeOut = Math.min(1, (1 - cycle) / FADE_EDGE);
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.min(fadeIn, fadeOut);
    }
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onTap();
  }

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <planeGeometry args={[6.4, 3]} />
        <meshBasicMaterial map={texture} transparent opacity={1} depthWrite={false} />
      </mesh>
      {/* Larger-than-the-sprite hit target, same reasoning as every other tap target in this scene — forgiving for small fingers. */}
      <mesh onClick={handleClick} visible={false}>
        <sphereGeometry args={[4.4, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
