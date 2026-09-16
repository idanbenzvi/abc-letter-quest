import { useEffect, useRef, useState, type ReactNode } from 'react';
import './ScreenTransition.css';

// Timings must match the CSS animations in ScreenTransition.css — every
// variant shares the same total duration and cover-point so the swap
// logic below doesn't need to know which one is currently playing.
// COVER_MS is the midpoint, the instant the overlay is fully covering
// the screen, which is the only moment it's safe to swap the DOM
// underneath without the old screen visibly popping to the new one.
const SWEEP_TOTAL_MS = 950;
const SWEEP_COVER_MS = 480;

const VARIANTS = ['wave', 'cloud', 'starlight', 'albatross'] as const;
type Variant = (typeof VARIANTS)[number];

function pickVariant(last: Variant | null): Variant {
  // Never the same one twice in a row — the entire point of having
  // three is that it doesn't start feeling like "the transition" again.
  const choices = last ? VARIANTS.filter((v) => v !== last) : VARIANTS;
  return choices[Math.floor(Math.random() * choices.length)];
}

interface SweepState {
  key: string;
  frozen: ReactNode;
  sweeping: boolean;
  variant: Variant | null;
}

/**
 * Wraps whichever screen is currently showing; wherever this is used,
 * changing `transitionKey` plays a full-screen animated wipe over the
 * swap instead of an instant cut — one of four variants (wave, cloud,
 * starlight, albatross — see the *Overlay components below), picked
 * fresh each time so repeat navigation stays visually interesting
 * rather than always showing the same transition. Reused at two
 * levels: App.tsx's
 * top-level screens (Onboarding / PlayerSelect / Dashboard /
 * FlightGameScreen) and FlightGameScreen's own intro -> flying -> end
 * phase changes — both are "moving between game screens" from a
 * player's point of view.
 *
 * `children` can keep re-rendering under the SAME key (e.g. a toast
 * appearing while `phase` stays 'flying') without ever triggering a
 * transition — while idle this always renders the live `children`
 * directly; the frozen snapshot only matters during an active sweep, to
 * hold the outgoing screen still until the overlay has fully covered it.
 */
export function ScreenTransition({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  const [state, setState] = useState<SweepState>({ key: transitionKey, frozen: children, sweeping: false, variant: null });
  const lastVariantRef = useRef<Variant | null>(null);

  if (transitionKey !== state.key && !state.sweeping) {
    // Render-phase state adjustment (React's own sanctioned pattern for
    // "derive/reset state when a prop changes") — state.frozen still
    // holds whatever was showing before this render, since nothing has
    // touched it yet; freezing it here is what keeps the outgoing
    // screen from being replaced before the overlay has covered it.
    const variant = pickVariant(lastVariantRef.current);
    lastVariantRef.current = variant;
    setState((s) => ({ key: transitionKey, frozen: s.frozen, sweeping: true, variant }));
  }

  useEffect(() => {
    if (!state.sweeping) return;
    const swapTimer = setTimeout(() => {
      setState((s) => ({ ...s, frozen: children }));
    }, SWEEP_COVER_MS);
    const endTimer = setTimeout(() => {
      setState((s) => ({ ...s, sweeping: false, variant: null }));
    }, SWEEP_TOTAL_MS);
    return () => {
      clearTimeout(swapTimer);
      clearTimeout(endTimer);
    };
    // Only the sweeping transition itself schedules these — re-running
    // per `children` change would restart the timers on every unrelated
    // re-render during the sweep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sweeping]);

  return (
    <>
      {state.sweeping ? state.frozen : children}
      {state.sweeping && state.variant === 'wave' && <WaveOverlay />}
      {state.sweeping && state.variant === 'cloud' && <CloudOverlay />}
      {state.sweeping && state.variant === 'starlight' && <StarlightOverlay />}
      {state.sweeping && state.variant === 'albatross' && <AlbatrossOverlay />}
    </>
  );
}

/** A wavy-crested band sweeping bottom-to-top — see docs comment on ScreenTransition for the shared swap timing this (and the other two) must match. */
function WaveOverlay() {
  return (
    <div className="st-overlay" aria-hidden="true">
      <svg className="st-wave-shape" viewBox="0 0 1440 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="st-wave-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sky-dark, #2e7fa8)" />
            <stop offset="45%" stopColor="var(--sky, #bfe0f2)" />
            <stop offset="55%" stopColor="var(--sky, #bfe0f2)" />
            <stop offset="100%" stopColor="var(--sky-dark, #2e7fa8)" />
          </linearGradient>
        </defs>
        <path
          fill="url(#st-wave-fill)"
          d="M0,120 C180,60 360,180 540,120 C720,60 900,180 1080,120 C1260,60 1440,180 1440,120
             L1440,680 C1260,620 1080,740 900,680 C720,620 540,740 360,680 C180,620 0,740 0,680 Z"
        />
        <path
          className="st-wave-crest"
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="10"
          strokeLinecap="round"
          d="M0,120 C180,60 360,180 540,120 C720,60 900,180 1080,120 C1260,60 1440,180 1440,120"
        />
      </svg>
    </div>
  );
}

// Position/size/delay for each puff — hand-placed (not random) so they
// reliably tile the whole viewport with no gaps once fully bloomed, and
// small delay spread (0-80ms) so every puff is comfortably near full
// scale by SWEEP_COVER_MS — see createPuffTexture-style soft-cloud
// styling in cloudLetter.ts for the same "puff" visual language this
// borrows, just as a CSS radial-gradient instead of a canvas texture.
const CLOUD_PUFFS = [
  { top: '-15%', left: '-12%', size: '72vw', delay: '0ms' },
  { top: '-18%', left: '46%', size: '76vw', delay: '40ms' },
  { top: '26%', left: '-16%', size: '66vw', delay: '70ms' },
  { top: '30%', left: '58%', size: '70vw', delay: '20ms' },
  { top: '66%', left: '6%', size: '70vw', delay: '60ms' },
  { top: '60%', left: '52%', size: '76vw', delay: '10ms' },
  { top: '18%', left: '20%', size: '58vw', delay: '80ms' },
];

/** Soft white cloud puffs blooming outward until they blanket the screen, then shrinking away — the day-mode "letter cloud" look, at screen scale. */
function CloudOverlay() {
  return (
    <div className="st-overlay" aria-hidden="true">
      {CLOUD_PUFFS.map((p, i) => (
        <div
          key={i}
          className="st-cloud-puff"
          style={{ top: p.top, left: p.left, width: p.size, height: p.size, animationDelay: p.delay }}
        />
      ))}
    </div>
  );
}

// Scattered star positions — hand-placed for an even, non-clustered
// spread; the dark background (below) is what actually guarantees full
// coverage, these are purely the "twinkling" accents on top of it.
const STAR_POINTS = [
  { top: '12%', left: '18%', size: '5vw', delay: '0ms' },
  { top: '22%', left: '68%', size: '6vw', delay: '60ms' },
  { top: '48%', left: '10%', size: '4vw', delay: '120ms' },
  { top: '58%', left: '82%', size: '5vw', delay: '30ms' },
  { top: '76%', left: '32%', size: '6vw', delay: '90ms' },
  { top: '34%', left: '42%', size: '7vw', delay: '150ms' },
  { top: '82%', left: '62%', size: '4vw', delay: '45ms' },
  { top: '8%', left: '46%', size: '4vw', delay: '105ms' },
  { top: '64%', left: '50%', size: '5vw', delay: '75ms' },
  { top: '40%', left: '88%', size: '4vw', delay: '15ms' },
];

/** Night falls fast and stars twinkle into view until the sky is solid dark, then fades back — the constellation-bonus night palette, at screen scale. */
function StarlightOverlay() {
  return (
    <div className="st-overlay" aria-hidden="true">
      <div className="st-star-bg" />
      {STAR_POINTS.map((s, i) => (
        <div
          key={i}
          className="st-star-point"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}

/**
 * The albatross itself flies straight at the camera: a warm sunset-
 * gradient panel is punched into the bird's own silhouette via a CSS
 * mask (the PNG's alpha channel — solid bird, transparent background —
 * is exactly what a mask needs, no processing required beyond dropping
 * it in as a mask-image), which grows from a distant speck to filling
 * the whole screen and back down, same as the other three. Where the
 * silhouette is opaque, the gradient shows through; scaled far larger
 * than the viewport, the visible crop lands entirely inside solid
 * wing/body territory, which is what actually guarantees full coverage
 * at the peak — the shape's outline never needs to touch the screen
 * edges for this to work.
 */
function AlbatrossOverlay() {
  return (
    <div className="st-overlay" aria-hidden="true">
      <div className="st-albatross-shape" />
    </div>
  );
}
