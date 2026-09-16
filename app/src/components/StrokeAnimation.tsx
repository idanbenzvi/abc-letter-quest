import { getLetterForm, VIEW_BOX } from '../data/letterStrokes';
import './StrokeAnimation.css';

interface StrokeAnimationProps {
  letter: string;
  isUpper: boolean;
  strokeDuration?: number; // seconds per stroke
  color?: string;
  dotColor?: string;
  size?: number; // px width; height derived from the shared viewBox aspect
  onComplete?: () => void;
}

const [, , VB_W, VB_H] = VIEW_BOX.split(' ').map(Number);

/**
 * Plays the "watch it get written" animation for one letterform —
 * see docs/04-screens-spec.md#3-letter-learning. This is a WATCH-only
 * demonstration (stroke-order + direction), not the touch-and-score
 * tracing interaction speced for Phase 2 — deliberately simpler:
 * no pointer input, no scoring, just `getLetterForm`'s path data
 * revealed in teaching order via stroke-dasharray/offset.
 */
export function StrokeAnimation({
  letter,
  isUpper,
  strokeDuration = 0.7,
  color = 'var(--coral)',
  dotColor = 'var(--sun)',
  size = 170,
  onComplete,
}: StrokeAnimationProps) {
  const { strokes } = getLetterForm(letter, isUpper);
  const height = size * (VB_H / VB_W);

  return (
    <svg viewBox={VIEW_BOX} width={size} height={height} aria-hidden="true">
      {strokes.map((d, i) => (
        <g key={i}>
          <path
            d={d}
            className="stroke-anim-path"
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDuration: `${strokeDuration}s`, animationDelay: `${i * strokeDuration}s` }}
            onAnimationEnd={i === strokes.length - 1 ? () => onComplete?.() : undefined}
          />
          <circle
            r={4.5}
            fill={dotColor}
            className="stroke-anim-dot"
            style={{
              offsetPath: `path('${d}')`,
              animationDuration: `${strokeDuration}s`,
              animationDelay: `${i * strokeDuration}s`,
            }}
          />
        </g>
      ))}
    </svg>
  );
}
