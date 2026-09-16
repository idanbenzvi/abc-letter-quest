import { useEffect, useRef, useState } from 'react';
import './AsciiCredit.css';

/**
 * A tiny hover-only credit tooltip, styled after the "shape-aware ASCII
 * renderer" look (Codrops, Sept 2026 — a GPU shader that matches each
 * character cell's local shape against 95 glyphs rather than just its
 * brightness, so edges print crisp instead of a staircase of `#`/`%`).
 * Reimplementing that exact per-cell shape-matching shader for a 2-second
 * hover tooltip would be solving the wrong problem — there's no 3D scene
 * here to sample. What's kept is the *idea* that reads from a screenshot
 * alone: monospace glyphs, a field of noisy ASCII settling into legible
 * print, dark terminal tone. The reveal below is a classic text-scramble
 * (random ramp characters resolving left-to-right into the real string)
 * rather than true shape-matching — an homage to the effect, not a port
 * of the algorithm.
 */

const GLYPHS = '.:-=+*#%@$&08XO';
const NOISE_COLS = 14;
const NOISE_ROWS = 3;
const REVEAL_STEP_MS = 28;

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

function useScrambleReveal(target: string, active: boolean): string {
  const [text, setText] = useState(() => ' '.repeat(target.length));

  useEffect(() => {
    if (!active) {
      setText(' '.repeat(target.length));
      return;
    }
    let frame = 0;
    const totalFrames = target.length * 2 + 8;
    const id = setInterval(() => {
      frame++;
      const revealCount = Math.min(target.length, Math.floor((frame / totalFrames) * target.length));
      let out = '';
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (ch === ' ' || i < revealCount) out += ch;
        else out += randomGlyph();
      }
      setText(out);
      if (revealCount >= target.length) clearInterval(id);
    }, REVEAL_STEP_MS);
    return () => clearInterval(id);
  }, [active, target]);

  return text;
}

/** A small field of flickering ASCII noise behind the credit line — the "renders as glyphs, not pixels" texture, not literal shape-matched output. */
function NoiseField({ active }: { active: boolean }) {
  const [grid, setGrid] = useState<string[]>(() => Array.from({ length: NOISE_COLS * NOISE_ROWS }, randomGlyph));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setGrid((prev) => prev.map((g) => (Math.random() < 0.12 ? randomGlyph() : g)));
    }, 140);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);

  return (
    <div className="ascii-credit-noise" aria-hidden="true">
      {grid.map((g, i) => (
        <span key={i}>{g}</span>
      ))}
    </div>
  );
}

export function AsciiCredit({ visible }: { visible: boolean }) {
  const line = useScrambleReveal('A game by Idan Ben-Zvi', visible);
  if (!visible) return null;
  return (
    <div className="ascii-credit" role="status">
      <NoiseField active={visible} />
      <span className="ascii-credit-text">{line}</span>
    </div>
  );
}
