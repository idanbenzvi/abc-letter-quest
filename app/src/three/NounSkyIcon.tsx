import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { createPuffTexture, makePuffSeeds } from './cloudLetter';
import { sampleIconPoints, buildConstellation } from './cloudIcon';

/**
 * A small bright core + crossed diffraction-spike glow, for the
 * "night" constellation joints — brighter and higher-contrast than
 * cloudLetter.ts's soft puff texture, which reads as cloud, not star.
 */
function createStarTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(220,240,255,0.9)');
    g.addColorStop(0.6, 'rgba(180,210,255,0.22)');
    g.addColorStop(1, 'rgba(180,210,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c, 3);
    ctx.lineTo(c, size - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, c);
    ctx.lineTo(size - 3, c);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface NounSkyIconProps {
  wordId: string;
  /** Night: glowing constellation trace (stars + connecting lines).
   * Day: soft white cloud/smoke-trail puffs — same technique as
   * LetterCloud, just tracing a word's silhouette instead of a glyph. */
  isNight: boolean;
  /** World units per sampled canvas pixel — see cloudLetter.ts. */
  scale?: number;
  /** True for ~0.4s after a wrong pick — a quick shake nudge, the
   * in-world equivalent of the old DOM button's shake animation. */
  wrong?: boolean;
  onTap?: () => void;
}

const SHAKE_SECONDS = 0.4;

/**
 * One picture-choice candidate, rendered as an actual object in the sky
 * next to the letter cloud instead of a flat 2D HUD button — tapping it
 * IS answering in the world. See cloudIcon.ts for how the shape comes
 * from the same hand-built silhouettes as WordIcons.tsx, and docs/03-
 * design-system.md's Flight HUD artboard for why the old flat button
 * row was removed.
 */
export function NounSkyIcon({ wordId, isNight, scale = 0.05, wrong = false, onTap }: NounSkyIconProps) {
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const dayPoints = useMemo(() => (isNight ? [] : sampleIconPoints(wordId)), [wordId, isNight]);
  const daySeeds = useMemo(() => makePuffSeeds(dayPoints), [dayPoints]);
  const dayTexture = useMemo(() => createPuffTexture(), []);
  const dayMeshRef = useRef<THREE.InstancedMesh>(null);

  const constellation = useMemo(() => (isNight ? buildConstellation(wordId) : { points: [], edges: [] }), [wordId, isNight]);
  const starSeeds = useMemo(() => makePuffSeeds(constellation.points), [constellation.points]);
  const starTexture = useMemo(() => createStarTexture(), []);
  const starMeshRef = useRef<THREE.InstancedMesh>(null);
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
    return geo;
  }, [constellation, scale]);

  const wrongRef = useRef(wrong);
  wrongRef.current = wrong;
  const shakeElapsed = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock, camera }, delta) => {
    const t = clock.getElapsedTime();

    if (wrongRef.current) shakeElapsed.current += delta;
    else shakeElapsed.current = 0;
    if (groupRef.current) {
      const st = shakeElapsed.current;
      groupRef.current.position.x = st > 0 && st < SHAKE_SECONDS ? Math.sin(st * 55) * 0.18 * (1 - st / SHAKE_SECONDS) : 0;
    }

    if (!isNight && dayMeshRef.current) {
      for (let i = 0; i < dayPoints.length; i++) {
        const p = dayPoints[i];
        const s = daySeeds[i];
        const breathe = s.maxScale * (0.88 + 0.12 * Math.sin(t * s.speed + s.phase));
        const driftX = Math.sin(t * s.speed * 0.6 + s.phase) * 2;
        const driftY = Math.cos(t * s.speed * 0.45 + s.phase * 1.7) * 2;
        dummy.position.set((p.x + driftX) * scale, (p.y + driftY) * scale, s.depthJitter);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotation.z += s.rotation;
        dummy.scale.setScalar(breathe * scale * 22);
        dummy.updateMatrix();
        dayMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      dayMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (isNight && starMeshRef.current) {
      for (let i = 0; i < constellation.points.length; i++) {
        const p = constellation.points[i];
        const s = starSeeds[i];
        const twinkle = 0.7 + 0.3 * Math.sin(t * s.speed * 1.6 + s.phase);
        dummy.position.set(p.x * scale, p.y * scale, s.depthJitter * 0.3);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.setScalar(twinkle * scale * 30);
        dummy.updateMatrix();
        starMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      starMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onTap?.();
  }

  return (
    <group ref={groupRef}>
      {!isNight && (
        <instancedMesh ref={dayMeshRef} args={[undefined, undefined, Math.max(1, dayPoints.length)]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={dayTexture} color="#ffffff" transparent opacity={0.92} depthWrite={false} />
        </instancedMesh>
      )}
      {isNight && (
        <>
          <lineSegments geometry={lineGeometry}>
            <lineBasicMaterial color="#bfe0ff" transparent opacity={0.55} depthWrite={false} />
          </lineSegments>
          <instancedMesh ref={starMeshRef} args={[undefined, undefined, Math.max(1, constellation.points.length)]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={starTexture} color="#ffffff" transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} />
          </instancedMesh>
        </>
      )}
      {/* Invisible, larger-than-the-shape hit target — same reasoning as EncounterCloud's proxy sphere. */}
      <mesh onClick={handleClick} visible={false}>
        <sphereGeometry args={[3.2, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
