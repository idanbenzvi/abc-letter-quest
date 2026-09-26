import { Suspense, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { FlightScene } from './FlightScene';
import { FlightLoadingVeil } from './FlightLoadingVeil';
import { AdaptiveQuality } from './AdaptiveQuality';
import { INITIAL_QUALITY, dprFromQuality } from './adaptiveQuality';

// The ocean/sky is a fullscreen raymarched shader (see OceanSky.tsx) —
// its cost scales directly with pixels rendered, so its raymarch detail
// and the render resolution are the two levers for frame rate. Both are
// calibrated live against measured fps by AdaptiveQuality (see
// adaptiveQuality.tsx); this is only the starting resolution.
const initialDpr = dprFromQuality(INITIAL_QUALITY);

/**
 * Everything that pulls three.js / R3F / drei into the bundle lives
 * behind this one module, which FlightGameScreen loads with a dynamic
 * `import()` — so the onboarding, player picker, intro and dashboard
 * ship in a small first chunk and the ~1MB 3D stack only downloads once
 * a flight is actually about to start (kicked off during the intro so
 * "Take Off!" is instant on anything but the very first cold load).
 */
export default function FlightCanvas(props: ComponentProps<typeof FlightScene>) {
  // Shared between the calibrator (writes) and OceanSky (reads, every
  // frame) — a ref, not state, so recalibrating never re-renders React.
  const qualityRef = useRef(INITIAL_QUALITY);
  return (
    <>
      {/* `flat` = no ACES tone mapping. The sky/ocean is a custom shader
          that ignores tone mapping, so with it on, every tone-mapped
          object in front — the white letter clouds, the bird — rendered
          a dull grey against a sky that wasn't compressed the same way.
          Confirmed by side-by-side screenshots, not assumed. */}
      <Canvas camera={{ fov: 60, near: 0.1, far: 2000 }} dpr={initialDpr} flat>
        <AdaptiveQuality qualityRef={qualityRef} />
        {/* AlbatrossModel.tsx loads the STL via useLoader, which suspends
            until the file's fetched/parsed — needs a boundary above it or
            React has nowhere to catch that. */}
        <Suspense fallback={null}>
          <FlightScene {...props} qualityRef={qualityRef} />
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
