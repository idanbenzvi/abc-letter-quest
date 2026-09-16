import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getLetterForm, VIEW_BOX } from '../data/letterStrokes';
import { samplePath, scoreTrace, type Point, type TraceScore } from '../engine/traceScoring';
import './TraceCanvas.css';

const [, , VB_W, VB_H] = VIEW_BOX.split(' ').map(Number);
const SAMPLE_SPACING = 4; // one target sample roughly every 4 viewBox units of arc length
const TOLERANCE = 13; // generous — finger-tracing on a tablet is imprecise, and this is about genuine effort, not precision

function firstPoint(d: string): Point {
  const m = /^M([\d.-]+),([\d.-]+)/.exec(d);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 50, y: 50 };
}

interface TraceCanvasProps {
  letter: string;
  size?: number;
  /** Final score (0-100) at the moment the child moves on — 0 if they never attempted a stroke. */
  onComplete: (score: number) => void;
}

/**
 * The "your turn" trace challenge — see
 * docs/04-screens-spec.md#trace-challenge-your-turn. Always the
 * uppercase form (bigger, simpler). Scoring is coverage+adherence
 * against the same stroke path data the writing animation uses
 * (engine/traceScoring.ts) — deliberately never blocks progress
 * regardless of score; a good score just earns a bonus star.
 */
export function TraceCanvas({ letter, size = 260, onComplete }: TraceCanvasProps) {
  const { strokes: targetPaths } = getLetterForm(letter, true);
  const height = size * (VB_H / VB_W);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const targetPointsRef = useRef<Point[]>([]);
  const isDrawingRef = useRef(false);

  const [userStrokes, setUserStrokes] = useState<Point[][]>([]);
  const [score, setScore] = useState<TraceScore | null>(null);

  useEffect(() => {
    const all: Point[] = [];
    for (const el of pathRefs.current) {
      if (!el) continue;
      const total = el.getTotalLength();
      const count = Math.max(6, Math.round(total / SAMPLE_SPACING));
      all.push(...samplePath(el, count));
    }
    targetPointsRef.current = all;
  }, [letter]);

  function toSvgPoint(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VB_W,
      y: ((clientY - rect.top) / rect.height) * VB_H,
    };
  }

  function handlePointerDown(e: ReactPointerEvent<SVGRectElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const p = toSvgPoint(e.clientX, e.clientY);
    setUserStrokes((prev) => [...prev, [p]]);
  }

  function handlePointerMove(e: ReactPointerEvent<SVGRectElement>) {
    if (!isDrawingRef.current) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    setUserStrokes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      next[next.length - 1] = [...next[next.length - 1], p];
      return next;
    });
  }

  function finishStroke() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setUserStrokes((prev) => {
      const result = scoreTrace(targetPointsRef.current, prev.flat(), TOLERANCE);
      setScore(result);
      return prev;
    });
  }

  function handleTryAgain() {
    setUserStrokes([]);
    setScore(null);
  }

  const start = firstPoint(targetPaths[0]);
  const feedback =
    score === null
      ? 'Trace the letter with your finger!'
      : score.score >= 70
        ? 'Wonderful tracing!'
        : score.score >= 40
          ? 'Good try — want to go over it once more?'
          : "Let's give it another go!";

  return (
    <div className="trace-wrap">
      <svg ref={svgRef} className="trace-canvas" viewBox={VIEW_BOX} width={size} height={height}>
        {targetPaths.map((d, i) => (
          <path key={`corridor-${i}`} d={d} fill="none" stroke="var(--sky)" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} />
        ))}
        {targetPaths.map((d, i) => (
          <path
            key={`guide-${i}`}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            d={d}
            fill="none"
            stroke="var(--sky-dark)"
            strokeWidth={3}
            strokeDasharray="1 10"
            strokeLinecap="round"
            opacity={0.5}
          />
        ))}
        <circle cx={start.x} cy={start.y} r={6} fill="var(--coral)" />
        <text x={start.x} y={start.y + 3.5} textAnchor="middle" fontSize={7} fontWeight={800} fill="white">
          1
        </text>

        {userStrokes.map((stroke, i) => (
          <polyline
            key={i}
            points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--coral)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        ))}

        <rect
          x={0}
          y={0}
          width={VB_W}
          height={VB_H}
          fill="transparent"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
        />
      </svg>

      {score !== null && (
        <svg viewBox="0 0 80 80" width={56} height={56}>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--surface-2)" strokeWidth="9" />
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke={score.score >= 70 ? 'var(--leaf)' : 'var(--sun)'}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 32}
            strokeDashoffset={2 * Math.PI * 32 * (1 - score.score / 100)}
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="46" textAnchor="middle" fontFamily="Nunito" fontWeight={800} fontSize={18} fill="var(--ink)">
            {score.score}
          </text>
        </svg>
      )}

      <span className="trace-feedback" style={{ color: score && score.score >= 70 ? 'var(--leaf-dark)' : 'var(--ink)' }}>
        {feedback}
      </span>

      <div className="trace-actions">
        {score !== null && (
          <button type="button" className="btn btn-secondary" onClick={handleTryAgain}>
            Try Again
          </button>
        )}
        <button type="button" className="btn btn-primary font-display" onClick={() => onComplete(score?.score ?? 0)}>
          {score === null ? 'Skip for now' : "I'm done!"}
        </button>
      </div>
    </div>
  );
}
