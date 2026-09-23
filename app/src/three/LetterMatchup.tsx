import { useRef, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { LetterCloud } from './LetterCloud';

export interface LetterMatchupProps {
  /** The two lowercase look-alike letters, already in the left/right order the caller wants shown (randomized per round so the correct one isn't always on the same side). */
  options: [string, string];
  /** Which option, if any, was just tapped wrong — shakes that one, then clears (same shake language as NounSkyIcon/PlaneChoice). */
  wrongOption?: string | null;
  nightDimRef: RefObject<number>;
  onPick: (option: string) => void;
}

const SLOT_X = [-5.4, 5.4];
const SHAKE_SECONDS = 0.4;

/**
 * "Which one did I say?" — two commonly-confused lowercase letters
 * (b/d, h/n, m/w...) shown side by side and completely still, unlike
 * the picture-choice/plane-choice bonuses which scatter or fly their
 * candidates. That's deliberate: this drill is about carefully comparing
 * two similar SHAPES, and motion would work against exactly the close
 * looking the child needs to do. See data/confusablePairs.ts for which
 * pairs are curated and FlightGameScreen's letterMatchup state for how
 * this plugs into the same scoring/streak/mastery wiring as every other
 * bonus solve.
 */
export function LetterMatchup({ options, wrongOption, nightDimRef, onPick }: LetterMatchupProps) {
  return (
    <group>
      {options.map((opt, i) => (
        <MatchupSlot key={opt} letter={opt} x={SLOT_X[i % SLOT_X.length]} wrong={wrongOption === opt} nightDimRef={nightDimRef} onTap={() => onPick(opt)} />
      ))}
    </group>
  );
}

function MatchupSlot({
  letter,
  x,
  wrong,
  nightDimRef,
  onTap,
}: {
  letter: string;
  x: number;
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
      <LetterCloud letter={letter} scale={0.05} nightDimRef={nightDimRef} />
      {/* Larger-than-the-puffs hit target, same reasoning as every other tap target in this scene. */}
      <mesh onClick={handleClick} visible={false}>
        <sphereGeometry args={[3.4, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
