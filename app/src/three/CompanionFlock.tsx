import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CompanionSpec {
  id: string;
  /** Letters mastered (box >= 4, see FlightGameScreen.tsx) before this one joins the flock. Spread across the 26-letter alphabet: an early win, then a slower trickle. */
  unlockAt: number;
  body: string;
  bodyLight: string;
  wing: string;
  stripes?: boolean;
}

const COMPANIONS: CompanionSpec[] = [
  { id: 'firefly', unlockAt: 1, body: '#6b5b2e', bodyLight: '#ffe066', wing: '#fff4c2' },
  { id: 'bee', unlockAt: 3, body: '#3a2a12', bodyLight: '#ffc233', wing: '#eaf6ff', stripes: true },
  { id: 'dragonfly', unlockAt: 6, body: '#1f6f6b', bodyLight: '#4fd8cf', wing: '#cdeeee' },
  { id: 'butterfly', unlockAt: 10, body: '#6a2f8f', bodyLight: '#c98bf0', wing: '#f3d9ff' },
  { id: 'flying-fish', unlockAt: 15, body: '#245a8f', bodyLight: '#6fb8f2', wing: '#dff0ff' },
  { id: 'chick', unlockAt: 21, body: '#c98a1e', bodyLight: '#ffd873', wing: '#fff1cf' },
  { id: 'owlet', unlockAt: 26, body: '#5a4632', bodyLight: '#c9a978', wing: '#ede0cc' },
];

// Local offsets (world units) inside flockGroupRef, a loose wedge
// trailing behind and slightly below the bird. Kept well short of the
// chase camera's own 6-unit trail distance (FlightScene's
// `camera.position.set(..., worldZ + 6)`) — an earlier version placed
// these 2.3-5.2 units back and they ended up almost AT the camera,
// which reads as severe perspective distortion (confirmed by
// screenshot: the flock appeared to have dropped down near the ocean
// surface, nowhere near the bird).
const FORMATION_OFFSETS: [number, number, number][] = [
  [-0.6, -0.08, 0.9],
  [0.6, -0.08, 0.9],
  [-0.95, -0.16, 1.3],
  [0.95, -0.16, 1.3],
  [0, -0.24, 1.7],
  [-1.2, -0.28, 2.1],
  [1.2, -0.28, 2.1],
];

/** A small round creature silhouette (body + two angled wings), the same runtime-canvas-texture technique as cloudLetter.ts's puffs/stars — species are differentiated by color/stripes rather than bespoke shapes, which is plenty at the size these render on screen. */
function createCompanionTexture(spec: CompanionSpec): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    ctx.save();
    ctx.translate(cx, cy - 1);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = spec.wing;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 0.55);
      ctx.beginPath();
      ctx.ellipse(side * 11, -3, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    const g = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, 9);
    g.addColorStop(0, spec.bodyLight);
    g.addColorStop(1, spec.body);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (spec.stripes) {
      ctx.strokeStyle = spec.body;
      ctx.lineWidth = 2;
      for (const dx of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy - 5);
        ctx.lineTo(cx + dx, cy + 5);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx + 3, cy - 2, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface CompanionFlockProps {
  /** How many letters the child has mastered — see FlightGameScreen.tsx. Each companion above joins the formation once its own threshold is reached; nothing renders until the first one unlocks. */
  masteredCount: number;
}

/**
 * Small creatures that join the flight formation behind the albatross as
 * the child masters letters — a persistent, visible collection reward
 * distinct from the star counter, rendered as a sibling of AlbatrossModel
 * inside FlightScene's birdGroupRef group so they move/bank with the bird
 * exactly like a real flock would. Procedural billboard sprites (same
 * "no bundled image asset" technique as cloudLetter.ts's puffs/stars),
 * not full rigged models — small and numerous enough that a real model
 * per species isn't worth the weight AlbatrossModel's own STL rig costs.
 */
export function CompanionFlock({ masteredCount }: CompanionFlockProps) {
  const unlocked = useMemo(() => COMPANIONS.filter((c) => masteredCount >= c.unlockAt), [masteredCount]);
  const textures = useMemo(() => unlocked.map((c) => createCompanionTexture(c)), [unlocked]);
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < unlocked.length; i++) {
      const sprite = spriteRefs.current[i];
      if (!sprite) continue;
      const [bx, by, bz] = FORMATION_OFFSETS[i % FORMATION_OFFSETS.length];
      const phase = i * 1.7;
      const bob = Math.sin(t * 1.6 + phase) * 0.18;
      const sway = Math.sin(t * 0.9 + phase * 1.3) * 0.12;
      const flap = 0.85 + 0.15 * Math.sin(t * 9 + phase * 2.1);
      sprite.position.set(bx + sway, by + bob, bz);
      sprite.scale.setScalar(0.7 * flap);
    }
  });

  if (unlocked.length === 0) return null;

  return (
    <group>
      {unlocked.map((c, i) => (
        <sprite
          key={c.id}
          ref={(el) => {
            spriteRefs.current[i] = el;
          }}
        >
          <spriteMaterial map={textures[i]} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
