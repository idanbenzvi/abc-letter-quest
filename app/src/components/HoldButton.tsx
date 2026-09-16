import { useEffect, useRef, useState, type ReactNode } from 'react';
import './HoldButton.css';

const DEFAULT_HOLD_MS = 1100;

/**
 * A press-and-hold button — the standard "grown-ups only" gate in kids'
 * apps. A quick tap does nothing except show the "hold" hint; keeping a
 * finger down for `holdMs` fills a ring around the button and then fires
 * `onComplete`. Small children rarely hold a button still for a full
 * second, which is exactly the point: it gates the parent dashboard and
 * its reset button without a lock icon or a maths quiz.
 */
export function HoldButton({
  onComplete,
  holdMs = DEFAULT_HOLD_MS,
  className = '',
  children,
  ariaLabel,
}: {
  onComplete: () => void;
  holdMs?: number;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  function clearHold() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function start(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    firedRef.current = false;
    setHolding(true);
    setHint(false);
    clearHold();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      setHolding(false);
      onComplete();
    }, holdMs);
  }

  function stop() {
    if (!timerRef.current && !holding) return;
    clearHold();
    setHolding(false);
    if (!firedRef.current) {
      setHint(true);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setHint(false), 1400);
    }
  }

  useEffect(
    () => () => {
      clearHold();
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    },
    [],
  );

  return (
    <span className={`hold-wrap${hint ? ' show-hint' : ''}`}>
      <button
        type="button"
        className={`hold-btn${holding ? ' holding' : ''} ${className}`}
        style={{ ['--hold-ms' as string]: `${holdMs}ms` }}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Keyboard users can't "hold" a click; Enter/Space just opens.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onComplete();
          }
        }}
        aria-label={ariaLabel}
      >
        <span className="hold-ring" aria-hidden="true" />
        <span className="hold-content">{children}</span>
      </button>
      <span className="hold-hint" role="status">
        Hold to open
      </span>
    </span>
  );
}
