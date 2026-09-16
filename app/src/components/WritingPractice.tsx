import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { WritingPracticeMode } from '../types';
import { getStrokePolylines, pointAlong, type Pt } from '../engine/strokeGeometry';
import { bounds, fitStrokes, scoreWriting, type WritingResult } from '../engine/writingScore';
import * as sfx from '../engine/sfx';
import { SparkleIcon } from './icons/Misc';
import './WritingPractice.css';

// Page geometry, in SVG user units (the viewBox). The three handwriting
// lines mirror the stroke data's own metrics (cap top 15, x-height 52,
// baseline 100, descender 116 in a 0..120 viewBox), scaled so the cap
// height is CAP_PX tall.
const VB_W = 960;
const VB_H = 360;
const CAP_LINE_Y = 74;
const BASE_LINE_Y = 232;
const CAP_PX = BASE_LINE_Y - CAP_LINE_Y; // 158
const TEMPLATE_CAP_TOP = 15;
const TEMPLATE_X_TOP = 52;
const TEMPLATE_BASE = 100;
const SCALE = CAP_PX / (TEMPLATE_BASE - TEMPLATE_CAP_TOP);
const MID_LINE_Y = CAP_LINE_Y + (TEMPLATE_X_TOP - TEMPLATE_CAP_TOP) * SCALE;
const SLOT_COUNT = 3;
const SLOT_W = VB_W / SLOT_COUNT;
// Scoring tolerances, in the same units. Deliberately generous: this is
// a six-year-old's finger, and the strictness lives in "every stroke".
const TOLERANCE = 28;
const CHECKPOINT_SPACING = 12;
const MIN_POINT_SPACING = 3;
const NUMBER_R = 15;
const ARROW_LEN = 20;

const templateY = (y: number) => CAP_LINE_Y + (y - TEMPLATE_CAP_TOP) * SCALE;
const templateX = (x: number, slot: number) => SLOT_W * slot + SLOT_W / 2 + (x - 50) * SCALE;

function pathFrom(points: Pt[]): string {
  if (points.length === 0) return '';
  return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} ` + points.slice(1).map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

interface WritingPracticeProps {
  /** The exact glyph to write (case matters). */
  letter: string;
  mode: Exclude<WritingPracticeMode, 'off'>;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * The lined writing page: "write the letter three times". Appears over
 * the frozen sky every few traced letters (FlightGameScreen decides
 * when), as the bridge from tracing a shape to actually writing it.
 *
 * Slot 1 is assisted — the same numbered, arrowed, comet-led guide as
 * the sky tracer, drawn on the page — unless the parent chose "always
 * assisted", in which case every slot is. Unassisted slots are just the
 * lines: the child writes freehand and the scorer (engine/writingScore.ts)
 * fits the letter's template onto whatever they drew before checking
 * that every stroke is there, so size and position are forgiven but a
 * missing bowl or crossbar is not. A "Show me" button on any unassisted
 * slot brings the guide back for that slot — the page must never trap a
 * child, and neither must "Skip for now".
 */
export function WritingPractice({ letter, mode, onComplete, onSkip }: WritingPracticeProps) {
  const strokes = useMemo(() => getStrokePolylines(letter), [letter]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [slot, setSlot] = useState(0);
  const [slotDone, setSlotDone] = useState<boolean[]>(() => Array(SLOT_COUNT).fill(false));
  const [assisted, setAssisted] = useState<boolean[]>(() => Array.from({ length: SLOT_COUNT }, (_, i) => mode === 'always-assisted' || i === 0));
  const [drawn, setDrawn] = useState<Pt[][][]>(() => Array.from({ length: SLOT_COUNT }, () => []));
  const [liveResult, setLiveResult] = useState<WritingResult | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const cometRefs = useRef<(SVGCircleElement | null)[]>([]);
  const liveResultRef = useRef<WritingResult | null>(null);
  liveResultRef.current = liveResult;

  // Template strokes placed on the page for each slot (assisted guide + direct scoring).
  const placed = useMemo<Pt[][][]>(
    () => Array.from({ length: SLOT_COUNT }, (_, s) => strokes.map((st) => st.points.map((p) => ({ x: templateX(p.x, s), y: templateY(p.y) })))),
    [strokes],
  );
  const templateHeightPx = useMemo(() => {
    const pts = strokes.flatMap((s) => s.points);
    if (pts.length === 0) return CAP_PX;
    const b = bounds(pts);
    return (b.maxY - b.minY) * SCALE;
  }, [strokes]);

  useEffect(() => {
    sfx.play('bonus');
  }, []);

  // The comet: one bright dot that runs each unfinished stroke of the
  // active (assisted) slot in teaching order, on a loop. Positioned by
  // hand each frame from the stroke's arc length — CSS motion paths on
  // SVG circles are inconsistent across tablets, and cx/cy work everywhere.
  useEffect(() => {
    if (!assisted[slot] || slotDone[slot] || finished) return;
    let raf = 0;
    const t0 = performance.now();
    const spans: [number, number, number][] = [];
    let t = 0;
    strokes.forEach((st, i) => {
      const dur = Math.max(0.7, Math.min(1.8, (st.length * SCALE) / 220));
      spans.push([i, t, t + dur]);
      t += dur + 0.35;
    });
    const total = t + 0.9;
    const tick = (now: number) => {
      const done = liveResultRef.current?.strokeDone ?? [];
      const loopT = ((now - t0) / 1000) % total;
      strokes.forEach((st, i) => {
        const el = cometRefs.current[i];
        if (!el) return;
        const span = spans[i];
        const active = !done[i] && loopT >= span[1] && loopT <= span[2];
        if (!active) {
          el.setAttribute('opacity', '0');
          return;
        }
        const f = (loopT - span[1]) / Math.max(0.0001, span[2] - span[1]);
        const eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        const p = pointAlong(st, eased * st.length);
        el.setAttribute('cx', templateX(p.x, slot).toFixed(1));
        el.setAttribute('cy', templateY(p.y).toFixed(1));
        el.setAttribute('opacity', '1');
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [assisted, slot, slotDone, finished, strokes]);

  function toSvg(e: ReactPointerEvent<SVGSVGElement>): Pt | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  function slotOf(p: Pt): number {
    return Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(p.x / SLOT_W)));
  }

  function evaluate(slotIndex: number, slotStrokes: Pt[][]): WritingResult {
    const drawnPts = slotStrokes.flat();
    if (assisted[slotIndex] || drawnPts.length < 4) {
      return scoreWriting(placed[slotIndex], slotStrokes, TOLERANCE, CHECKPOINT_SPACING, templateHeightPx);
    }
    // Freehand: fit the template to what was drawn, then score.
    const tplPts = placed[slotIndex].flat();
    const fitted = fitStrokes(
      strokes.map((s, i) => ({ ...s, points: placed[slotIndex][i] })),
      bounds(tplPts),
      bounds(drawnPts),
      8 * SCALE,
    );
    return scoreWriting(fitted, slotStrokes, TOLERANCE, CHECKPOINT_SPACING, templateHeightPx);
  }

  function handleDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (finished || pointerIdRef.current !== null) return;
    const p = toSvg(e);
    if (!p) return;
    // Only the active slot accepts ink; a touch elsewhere is ignored (not punished).
    if (slotOf(p) !== slot) {
      setNudge('Write in the glowing box');
      setTimeout(() => setNudge(null), 1200);
      return;
    }
    pointerIdRef.current = e.pointerId;
    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawn((prev) => {
      const next = prev.map((s) => s.slice());
      next[slot] = [...next[slot], [p]];
      return next;
    });
  }

  function handleMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!drawingRef.current || e.pointerId !== pointerIdRef.current) return;
    const p = toSvg(e);
    if (!p) return;
    setDrawn((prev) => {
      const cur = prev[slot];
      if (cur.length === 0) return prev;
      const last = cur[cur.length - 1];
      const tail = last[last.length - 1];
      if (tail && Math.hypot(tail.x - p.x, tail.y - p.y) < MIN_POINT_SPACING) return prev;
      const next = prev.map((s) => s.slice());
      next[slot] = [...cur.slice(0, -1), [...last, p]];
      if (assisted[slot]) setLiveResult(evaluate(slot, next[slot]));
      return next;
    });
  }

  function handleUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerId !== pointerIdRef.current) return;
    drawingRef.current = false;
    pointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    const slotStrokes = drawn[slot];
    if (slotStrokes.length === 0) return;
    attemptsRef.current += 1;
    const result = evaluate(slot, slotStrokes);
    setLiveResult(result);
    if (result.complete) {
      sfx.play('stroke');
      sfx.haptic(12);
      const done = slotDone.slice();
      done[slot] = true;
      setSlotDone(done);
      setNudge(null);
      if (done.every(Boolean)) {
        setFinished(true);
        setTimeout(() => sfx.play('bonus'), 250);
        setTimeout(onComplete, 1500);
      } else {
        setTimeout(() => {
          setSlot(slot + 1);
          setLiveResult(null);
          attemptsRef.current = 0;
        }, 550);
      }
    } else if (result.strokeDone.some(Boolean) && !result.strokeDone.every(Boolean)) {
      const missing = result.strokeDone.filter((d) => !d).length;
      setNudge(missing === 1 ? 'One more part to go!' : `${missing} more parts to go!`);
    } else if (slotStrokes.flat().length > 20 && attemptsRef.current >= 2 && !assisted[slot]) {
      setNudge('Tap "Show me" for a little help');
    }
  }

  function clearSlot() {
    sfx.play('tap');
    setDrawn((prev) => {
      const next = prev.map((s) => s.slice());
      next[slot] = [];
      return next;
    });
    setLiveResult(null);
    setNudge(null);
  }

  function showGuide() {
    sfx.play('tap');
    setAssisted((prev) => prev.map((a, i) => (i === slot ? true : a)));
    setNudge(null);
    setLiveResult(null);
  }

  const guideFor = (slotIndex: number) => {
    if (!assisted[slotIndex] || slotDone[slotIndex]) return null;
    const res = slotIndex === slot ? liveResult : null;
    return (
      <g className="wp-guide" key={`guide-${slotIndex}`}>
        {strokes.map((st, si) => {
          const pts = placed[slotIndex][si];
          const done = res?.strokeDone[si] === true;
          const d = pathFrom(pts);
          const end = pts[pts.length - 1];
          const back = pointAlong(st, Math.max(0, st.length - 6));
          const backPt = { x: templateX(back.x, slotIndex), y: templateY(back.y) };
          const angle = (Math.atan2(end.y - backPt.y, end.x - backPt.x) * 180) / Math.PI;
          const start = pts[0];
          return (
            <g key={si} className={done ? 'wp-stroke done' : 'wp-stroke'}>
              <path d={d} className="wp-guide-halo" />
              <path d={d} className="wp-guide-path" />
              {slotIndex === slot && (
                <circle
                  r={8}
                  className="wp-comet"
                  opacity={0}
                  ref={(el) => {
                    cometRefs.current[si] = el;
                  }}
                />
              )}
              {st.length > 10 && (
                <polygon
                  className="wp-arrow"
                  points={`${-ARROW_LEN * 0.7},${-ARROW_LEN * 0.55} ${ARROW_LEN * 0.55},0 ${-ARROW_LEN * 0.7},${ARROW_LEN * 0.55}`}
                  transform={`translate(${end.x.toFixed(1)} ${end.y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
                />
              )}
              <g className="wp-number" transform={`translate(${start.x.toFixed(1)} ${start.y.toFixed(1)})`}>
                <circle r={NUMBER_R} />
                <text y={5.5}>{si + 1}</text>
              </g>
            </g>
          );
        })}
      </g>
    );
  };

  const title = finished ? 'Beautiful writing!' : `Write the letter ${letter}`;
  const subtitle = finished
    ? 'Three times, all by yourself. The nest will be proud.'
    : assisted[slot]
      ? slot === 0 && mode === 'first-assisted'
        ? 'Follow the golden path first — then try it on your own.'
        : 'Follow the golden path.'
      : 'Now write it yourself, between the lines.';

  return (
    <div className="wp-overlay" role="dialog" aria-modal="true" aria-label={`Write the letter ${letter}`}>
      <div className={`wp-card${finished ? ' finished' : ''}`}>
        <div className="wp-head">
          <span className="wp-eyebrow">
            <SparkleIcon size={14} /> Writing time
          </span>
          <h2 className="wp-title font-display">{title}</h2>
          <p className="wp-sub">{subtitle}</p>
        </div>

        <div className="wp-page-wrap">
          <svg
            ref={svgRef}
            className="wp-page"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          >
            <defs>
              <filter id="wp-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="wp-glow-soft" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
            </defs>

            {/* slot highlights */}
            {Array.from({ length: SLOT_COUNT }, (_, i) => (
              <rect
                key={`slot-${i}`}
                className={`wp-slot${i === slot && !finished ? ' active' : ''}${slotDone[i] ? ' done' : ''}`}
                x={SLOT_W * i + 10}
                y={CAP_LINE_Y - 44}
                width={SLOT_W - 20}
                height={BASE_LINE_Y - CAP_LINE_Y + 110}
                rx={26}
              />
            ))}

            {/* the lines — dashed, drawn in with a shimmer */}
            <line className="wp-line cap" x1={24} y1={CAP_LINE_Y} x2={VB_W - 24} y2={CAP_LINE_Y} />
            <line className="wp-line mid" x1={24} y1={MID_LINE_Y} x2={VB_W - 24} y2={MID_LINE_Y} />
            <line className="wp-line base" x1={24} y1={BASE_LINE_Y} x2={VB_W - 24} y2={BASE_LINE_Y} />
            <circle className="wp-line-spark" r={7} cx={24} cy={CAP_LINE_Y} />
            <circle className="wp-line-spark two" r={7} cx={24} cy={BASE_LINE_Y} />

            {/* guides (assisted slots) */}
            {Array.from({ length: SLOT_COUNT }, (_, i) => guideFor(i))}

            {/* ink */}
            {drawn.map((slotStrokes, i) => (
              <g key={`ink-${i}`} className={`wp-ink${slotDone[i] ? ' done' : ''}`} filter="url(#wp-glow)">
                {slotStrokes.map((pts, k) => (
                  <path key={k} d={pathFrom(pts)} />
                ))}
              </g>
            ))}

            {/* done badges */}
            {slotDone.map(
              (d, i) =>
                d && (
                  // Outer <g> carries the SVG translate; the pop-in animation
                  // (a CSS transform) lives on the inner one — a CSS transform
                  // would otherwise override the attribute and park the badge
                  // at the page's origin.
                  <g key={`badge-${i}`} transform={`translate(${SLOT_W * i + SLOT_W / 2} ${CAP_LINE_Y - 22})`}>
                    <g className="wp-badge">
                      <circle r={16} />
                      <path d="M-7,0 L-2,5 L8,-6" />
                    </g>
                  </g>
                ),
            )}
          </svg>
        </div>

        <div className="wp-foot">
          <div className="wp-nudge" aria-live="polite">
            {nudge ?? ''}
          </div>
          <div className="wp-actions">
            {!finished && (
              <>
                <button type="button" className="wp-btn" onClick={clearSlot} disabled={drawn[slot].length === 0}>
                  Start over
                </button>
                {!assisted[slot] && (
                  <button type="button" className="wp-btn" onClick={showGuide}>
                    Show me
                  </button>
                )}
                <button
                  type="button"
                  className="wp-btn ghost"
                  onClick={() => {
                    sfx.play('tap');
                    onSkip();
                  }}
                >
                  Skip for now
                </button>
              </>
            )}
          </div>
        </div>

        {finished && (
          <div className="wp-sparkles" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ left: `${8 + ((i * 37) % 84)}%`, top: `${10 + ((i * 53) % 70)}%`, animationDelay: `${(i % 7) * 0.12}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
