import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { dprFromQuality } from './adaptiveQuality';

// The calibration loop itself — see adaptiveQuality.ts for the levers it drives.

/** Below this, quality steps down. */
const FPS_FLOOR = 40;
/** At or above this for RISE_AFTER_SECONDS, there's headroom — quality creeps back up. (Just under 60 so a 60Hz display's vsync-capped ~59.x still counts.) */
const FPS_HEADROOM = 55;
const WINDOW_SECONDS = 0.5;
const RISE_AFTER_SECONDS = 2;
// Down fast (a stutter is felt immediately), up slow (~15s from floor to
// full) so the sea's look drifts rather than visibly changing.
const DROP_STEP = 0.08;
const DROP_STEP_SEVERE = 0.15; // under 30fps
const RISE_STEP = 0.03;
// After a rise causes a drop, don't climb back to that level for a
// while — otherwise it would see-saw across the same threshold forever.
const CEILING_SECONDS = 20;
// A frame this long is a tab switch or a debugger stop, not a
// steady-state reading — ignored rather than counted. Deliberately
// generous: a device genuinely rendering at 3-4fps has every frame over
// a quarter second, and is exactly the one that most needs to step down
// (an earlier 0.25s cutoff froze calibration on such a device — caught
// in a SwiftShader test run, not by reasoning).
const MAX_SANE_DELTA = 1;

/**
 * Renders nothing — measures fps inside the R3F loop and writes the
 * calibrated level into `qualityRef` (read by OceanSky every frame) and
 * the renderer's DPR. Mount once inside the Canvas.
 */
export function AdaptiveQuality({ qualityRef }: { qualityRef: React.RefObject<number> }) {
  const setDpr = useThree((s) => s.setDpr);
  const m = useRef({ frames: 0, time: 0, goodFor: 0, ceiling: 1, ceilingFor: 0, dpr: dprFromQuality(qualityRef.current) });

  useFrame((_, delta) => {
    if (delta > MAX_SANE_DELTA) return;
    const s = m.current;
    s.frames += 1;
    s.time += delta;
    if (s.ceilingFor > 0) s.ceilingFor -= delta;
    else s.ceiling = 1;
    if (s.time < WINDOW_SECONDS) return;

    const fps = s.frames / s.time;
    s.frames = 0;
    const windowTime = s.time;
    s.time = 0;

    let q = qualityRef.current;
    if (fps < FPS_FLOOR) {
      // Remember the level that couldn't hold, so the climb back stops just short of it.
      s.ceiling = Math.max(0, q - RISE_STEP);
      s.ceilingFor = CEILING_SECONDS;
      q = Math.max(0, q - (fps < 30 ? DROP_STEP_SEVERE : DROP_STEP));
      s.goodFor = 0;
    } else if (fps >= FPS_HEADROOM) {
      s.goodFor += windowTime;
      if (s.goodFor >= RISE_AFTER_SECONDS) q = Math.min(s.ceiling, 1, q + RISE_STEP);
    } else {
      s.goodFor = 0;
    }
    qualityRef.current = q;

    const dpr = dprFromQuality(q);
    if (dpr !== s.dpr) {
      s.dpr = dpr;
      setDpr(dpr);
    }
    if (import.meta.env.DEV) (window as unknown as { __flightQuality?: object }).__flightQuality = { fps: Math.round(fps), quality: +q.toFixed(3), dpr };
  });

  return null;
}
