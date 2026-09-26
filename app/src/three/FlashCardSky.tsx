import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { getFlashCardTexture } from './flashCardTexture';

interface FlashCardSkyProps {
  wordId: string;
  isNight: boolean;
  scale?: number;
  wrong?: boolean;
  revealed?: boolean;
  fading?: boolean;
  /** A gentle pulsing glow nudging toward this card — the storm round's hint after a couple of misses. */
  hint?: boolean;
  onTap?: () => void;
}

const SHAKE_SECONDS = 0.4;

// A soft round glow for the aura behind a card — a plain coloured plane
// read as a hard yellow box once the cards actually rendered.
let glowTexture: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}
const CARD_WIDTH = 3.6;
const CARD_HEIGHT = 4.32;

/**
 * 3D Flash Card item floating in the sky during the multiple choice bonus round.
 * Follows an authentic nautical/boho coastal aesthetic.
 * Names and letter badges are hidden until correctly selected.
 */
export function FlashCardSky({
  wordId,
  isNight,
  scale = 1,
  wrong = false,
  revealed = false,
  fading = false,
  hint = false,
  onTap,
}: FlashCardSkyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cardMeshRef = useRef<THREE.Mesh>(null);
  const glowMeshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const normalTexture = useMemo(() => getFlashCardTexture(wordId, false), [wordId]);
  const revealedTexture = useMemo(() => getFlashCardTexture(wordId, true), [wordId]);
  
  const [hovered, setHovered] = useState(false);
  const wrongRef = useRef(wrong);
  wrongRef.current = wrong;
  const shakeElapsed = useRef(0);
  const currentScaleRef = useRef(scale);
  const opacityRef = useRef(0.98);

  useFrame(({ clock, camera }, delta) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    // Billboarding: Smoothly align with the camera
    groupRef.current.quaternion.copy(camera.quaternion);

    // Gentle nautical mobile sway and bobbing in the sea breeze
    const bob = Math.sin(t * 1.8 + (groupRef.current.position.x * 0.4)) * (revealed ? 0.22 : 0.12);
    const tilt = Math.sin(t * 1.3 + (groupRef.current.position.y * 0.3)) * (revealed ? 0.05 : 0.025);
    if (cardMeshRef.current) {
      cardMeshRef.current.position.y = bob;
      cardMeshRef.current.rotation.z = tilt;
    }

    // Shake animation on incorrect selection
    if (wrongRef.current) {
      shakeElapsed.current += delta;
    } else {
      shakeElapsed.current = 0;
    }
    const st = shakeElapsed.current;
    if (st > 0 && st < SHAKE_SECONDS) {
      const shakeOffset = Math.sin(st * 50) * 0.35 * (1 - st / SHAKE_SECONDS);
      groupRef.current.position.x += shakeOffset * delta * 20;
    }

    // Scale dynamics: hover lift or triumphant celebration lift
    let targetScale = scale * (hovered ? 1.1 : 1.0);
    if (revealed) targetScale = scale * 1.22;
    if (fading) targetScale = scale * 0.85;

    currentScaleRef.current = THREE.MathUtils.lerp(currentScaleRef.current, targetScale, 0.12);
    groupRef.current.scale.setScalar(currentScaleRef.current);

    // Opacity handling for fade out
    const targetOpacity = fading ? 0 : 0.98;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, fading ? 0.15 : 0.2);
    if (materialRef.current) {
      materialRef.current.opacity = opacityRef.current;
    }

    // Pulse celebration glow
    if (glowMeshRef.current && (revealed || isNight || hint)) {
      const pulse = 0.4 + Math.sin(t * 4) * 0.15;
      const glowMat = glowMeshRef.current.material as THREE.MeshBasicMaterial;
      if (glowMat) glowMat.opacity = revealed ? pulse + 0.3 : hint ? 0.25 + Math.sin(t * 3) * 0.2 : 0.3;
    }
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (revealed || fading) return;
    onTap?.();
  }

  function handlePointerOver(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    if (revealed || fading) return;
    setHovered(true);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'pointer';
    }
  }

  function handlePointerOut() {
    setHovered(false);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'auto';
    }
  }

  return (
    <group ref={groupRef}>
      {/* Golden Celebration Aura or Night lantern back-glow */}
      {(revealed || isNight || hint) && (
        <mesh ref={glowMeshRef} position={[0, 0, -0.05]}>
          <planeGeometry args={[CARD_WIDTH * 1.7, CARD_HEIGHT * 1.6]} />
          <meshBasicMaterial
            map={getGlowTexture()}
            color={revealed ? '#f7c948' : '#ffd45e'}
            transparent
            opacity={revealed ? 0.6 : 0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* The Flash Card Surface */}
      <mesh ref={cardMeshRef}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshBasicMaterial
          ref={materialRef}
          map={revealed ? revealedTexture : normalTexture}
          transparent
          opacity={0.98}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Invisible generous touch & click hit proxy */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        visible={false}
      >
        <planeGeometry args={[CARD_WIDTH * 1.35, CARD_HEIGHT * 1.35]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
