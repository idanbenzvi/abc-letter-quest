import { useEffect, useRef } from 'react';
import './FpsMeter.css';

/** Under this the reading turns red. */
const SLOW_FPS = 30;
const WINDOW_MS = 500;

/**
 * Frames per second, top left, for testing on real devices. Counts
 * requestAnimationFrame callbacks — the same clock the 3D scene renders
 * on, so a heavy frame slows this count exactly as much as the game.
 * Writes straight to the DOM every half second rather than through React
 * state, so the meter itself never costs a re-render.
 */
export function FpsMeter() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let start = performance.now();
    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - start;
      if (elapsed >= WINDOW_MS) {
        const fps = Math.round((frames * 1000) / elapsed);
        const el = ref.current;
        if (el) {
          el.textContent = `${fps} fps`;
          el.classList.toggle('fps-meter--slow', fps < SLOW_FPS);
        }
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className="fps-meter" aria-hidden="true">
      – fps
    </div>
  );
}
