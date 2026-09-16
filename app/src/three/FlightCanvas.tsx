import { Suspense, useEffect, useState, type ComponentProps } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { FlightScene } from './FlightScene';
import { FlightLoadingVeil } from './FlightLoadingVeil';
import { isLowPowerDevice } from '../engine/preload';

// The ocean/sky is a fullscreen raymarched shader (see OceanSky.tsx) —
// its cost scales directly with pixels rendered, so on top of dropping
// its own raymarch quality (FlightScene.tsx's oceanQuality), rendering
// at native resolution instead of R3F's default up-to-2x supersample is
// the other big lever for keeping a phone/tablet at 60fps. Decided once
// at module load, same reasoning as FlightScene's oceanQuality.
const canvasDpr: number | [number, number] = isLowPowerDevice() ? 1 : [1, 2];

/**
 * Everything that pulls three.js / R3F / drei into the bundle lives
 * behind this one module, which FlightGameScreen loads with a dynamic
 * `import()` — so the onboarding, player picker, intro and dashboard
 * ship in a small first chunk and the ~1MB 3D stack only downloads once
 * a flight is actually about to start (kicked off during the intro so
 * "Take Off!" is instant on anything but the very first cold load).
 */
export default function FlightCanvas(props: ComponentProps<typeof FlightScene>) {
  return (
    <>
      {/* `flat` = no ACES tone mapping. The sky/ocean is a custom shader
          that ignores tone mapping, so with it on, every tone-mapped
          object in front — the white letter clouds, the bird — rendered
          a dull grey against a sky that wasn't compressed the same way.
          Confirmed by side-by-side screenshots, not assumed. */}
      <Canvas camera={{ fov: 60, near: 0.1, far: 2000 }} dpr={canvasDpr} flat>
        {/* AlbatrossModel.tsx loads the STL via useLoader, which suspends
            until the file's fetched/parsed — needs a boundary above it or
            React has nowhere to catch that. */}
        <Suspense fallback={null}>
          <FlightScene {...props} />
        </Suspense>
      </Canvas>
      <LoadingVeil />
    </>
  );
}

/** "Getting the bird ready" overlay while the STL (or anything else suspended inside the Canvas) is still loading. */
function LoadingVeil() {
  const { active, progress } = useProgress();
  const [show, setShow] = useState(active);
  // Keep the veil up a beat after loading finishes so the first frame
  // underneath isn't a half-built scene, and never flash it for loads
  // that resolve instantly from cache.
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setShow(true), 120);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShow(false), 250);
    return () => clearTimeout(t);
  }, [active]);
  if (!show) return null;
  return <FlightLoadingVeil progress={progress} />;
}
