import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FlashCardSky } from './FlashCardSky';

export interface StormCardsRound {
  cardIds: string[];
  oddId: string;
  /** Card id just tapped wrong — shakes it. */
  wrongId: string | null;
  solved: boolean;
  /** After a couple of misses, the odd card gets a gentle glow. */
  hint: boolean;
}

// The three flash cards hang in the storm in front of the camera,
// following it as the (slowed) flight carries on, so they never drift out
// of view while a child is still thinking. Scaled to fit a portrait
// phone's much narrower view.
const DISTANCE = 13;
// Up in the top half of the view, clear of the albatross (which flies at
// the centre of the frame and otherwise covers the middle card).
const LIFT = 2.1;
const CARD_W = 3.6; // FlashCardSky's own card width at scale 1
const GAP = 0.7;
const POP_SECONDS = 0.6;

export function StormCards({ round, isNight, onPick }: { round: StormCardsRound; isNight: boolean; onPick: (id: string) => void }) {
  const size = useThree((st) => st.size);
  const fovDeg = useThree((st) => (st.camera instanceof THREE.PerspectiveCamera ? st.camera.fov : 60));
  const halfWidth = DISTANCE * Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * (size.width / Math.max(1, size.height));
  const s = Math.min(1, (halfWidth * 2 * 0.88) / (3 * CARD_W + 2 * GAP));
  const spacing = (CARD_W + GAP) * s;

  const cards = useRef<(THREE.Group | null)[]>([]);
  const age = useRef(0);
  const fwd = useRef(new THREE.Vector3()).current;
  const up = useRef(new THREE.Vector3()).current;
  const right = useRef(new THREE.Vector3()).current;
  const centre = useRef(new THREE.Vector3()).current;

  useFrame(({ camera }, delta) => {
    age.current += delta;
    camera.getWorldDirection(fwd);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    centre.copy(camera.position).addScaledVector(fwd, DISTANCE).addScaledVector(up, LIFT * s);
    // Pop in: a quick overshoot so the cards arrive with the storm, not just appear.
    const t = Math.min(1, age.current / POP_SECONDS);
    const pop = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.5) : 1;
    cards.current.forEach((g, i) => {
      if (!g) return;
      // Positioned along the camera's own right/forward axes, NOT by
      // rotating a parent group: FlashCardSky already billboards itself
      // to the camera, and a rotated parent would apply that twice.
      g.position.copy(centre).addScaledVector(right, (i - 1) * spacing);
      g.scale.setScalar(Math.max(0.001, pop));
    });
  });

  return (
    <>
      {round.cardIds.map((id, i) => (
        <group
          key={id}
          ref={(g) => {
            cards.current[i] = g;
          }}
        >
          <FlashCardSky
            wordId={id}
            isNight={isNight}
            scale={s}
            wrong={round.wrongId === id}
            revealed={round.solved && id === round.oddId}
            fading={round.solved && id !== round.oddId}
            hint={round.hint && !round.solved && id === round.oddId}
            onTap={() => onPick(id)}
          />
        </group>
      ))}
    </>
  );
}
