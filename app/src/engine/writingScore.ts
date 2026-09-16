import type { GuideStroke, Pt } from './strokeGeometry';
import { checkpointsAlong, nearestStrokeIndex } from './strokeGeometry';

// Scoring for the lined writing round (components/WritingPractice.tsx).
// Same philosophy as the sky tracer (three/LetterTracer.tsx): strict
// about the PARTS — every stroke of the letter must be present — and
// lenient about the manner. Two modes:
//
//  - assisted: the template sits exactly where the guide is drawn, so the
//    child's points are scored against it directly.
//  - unassisted (freehand): the child decides where and how big to write,
//    so the template is first fitted onto the bounding box of what they
//    drew (per axis), and THEN scored. Size and position are forgiven;
//    missing or misplaced parts are not. A scribble that merely fills the
//    box is rejected by the adherence check (most of what was drawn must
//    lie near the letter's strokes).

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WritingResult {
  /** Per stroke: fraction of that stroke's checkpoints the drawing covered. */
  coverage: number[];
  /** Per stroke: covered enough to count as written. */
  strokeDone: boolean[];
  /** Fraction of the drawn points that lie near some stroke of the letter. */
  adherence: number;
  /** All strokes done, adherence acceptable, drawing not a speck. */
  complete: boolean;
  /** The template checkpoints in the space they were scored in — for lighting the guide's dots. */
  checkpoints: Pt[][];
  covered: boolean[][];
}

export const STROKE_DONE_FRACTION = 0.8;
export const ADHERENCE_MIN = 0.55;
// A drawing shorter than this fraction of the template's height is a
// stray mark, not an attempt — never scored as complete.
const MIN_DRAWN_HEIGHT_FRACTION = 0.35;
// Below this template width (in the template's own units) the letter is
// a single vertical (I, l, i…) and an x-fit would divide by ~zero.
const MIN_FIT_WIDTH = 8;

export function bounds(points: Pt[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/** Maps every point of `strokes` through an affine per-axis fit from `from` onto `to`. */
export function fitStrokes(strokes: GuideStroke[], from: Bounds, to: Bounds, minFitWidth = MIN_FIT_WIDTH): Pt[][] {
  const fromW = from.maxX - from.minX;
  const fromH = Math.max(1e-6, from.maxY - from.minY);
  const sy = (to.maxY - to.minY) / fromH;
  const narrow = fromW < minFitWidth;
  const sx = narrow ? sy : (to.maxX - to.minX) / Math.max(1e-6, fromW);
  const fromCx = (from.minX + from.maxX) / 2;
  const toCx = (to.minX + to.maxX) / 2;
  return strokes.map((s) =>
    s.points.map((p) => ({
      x: narrow ? toCx + (p.x - fromCx) * sx : to.minX + (p.x - from.minX) * sx,
      y: to.minY + (p.y - from.minY) * sy,
    })),
  );
}

function toStroke(points: Pt[]): GuideStroke {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { points, cum, length: cum[cum.length - 1] };
}

/**
 * Scores `drawn` (the child's strokes — GESTURES: each element is one
 * continuous pointer-down-to-up drag, in any coordinate space) against
 * `templatePx` (the letter's strokes already placed in that same
 * space). `tolerance` and `checkpointSpacing` are in that space's units.
 *
 * Each gesture is locked to whichever template stroke it started
 * nearest to (among strokes not yet done from earlier gestures in this
 * same call) and scored ONLY against that one stroke for its entire
 * length — same fix, same reason, as the sky tracer's `activeStrokeRef`
 * (LetterTracer.tsx): 'd'/'b'/'p'/'q' place their stem right against
 * the bowl's own edge, and 'A'/other letters place a short stroke
 * exactly touching a long one by construction (a crossbar meeting both
 * legs) — AT that touch point, distance to "my own stroke" and distance
 * to "the stroke touching me" are within a fraction of a unit of each
 * other, a real coin flip once checked per point rather than per drag.
 * Locking per gesture instead of per point sidesteps the ambiguity: a
 * drag that starts unambiguously on the stem can never be reattributed
 * mid-stroke just because it later passes close to something else.
 */
export function scoreWriting(templatePx: Pt[][], drawn: Pt[][], tolerance: number, checkpointSpacing: number, templateHeight: number): WritingResult {
  const checkpoints = templatePx.map((pts) => checkpointsAlong(toStroke(pts), checkpointSpacing));
  const drawnPts = drawn.flat();
  const covered = checkpoints.map((cps) => cps.map(() => false));
  const done = checkpoints.map(() => false);
  const tol2 = tolerance * tolerance;
  for (const gesture of drawn) {
    if (gesture.length === 0) continue;
    let si = nearestStrokeIndex(gesture[0], checkpoints, (i) => !done[i]);
    // Every template stroke already done (e.g. a stray extra gesture
    // retracing a finished slot) — falls back to "nearest overall" only
    // so `si` is never -1 with any strokes present; contributes nothing
    // new either way since `done[si]` short-circuits the loop below.
    if (si === -1) si = nearestStrokeIndex(gesture[0], checkpoints, () => true);
    if (si === -1) continue;
    const cps = checkpoints[si];
    const row = covered[si];
    const lastIndex = cps.length - 1;
    for (const d of gesture) {
      if (done[si]) break;
      for (let ci = 0; ci < cps.length; ci++) {
        if (row[ci]) continue;
        const dx = cps[ci].x - d.x;
        const dy = cps[ci].y - d.y;
        if (dx * dx + dy * dy < tol2) row[ci] = true;
      }
      const coveredCount = row.filter(Boolean).length;
      if (row[0] && row[lastIndex] && coveredCount >= Math.ceil(cps.length * STROKE_DONE_FRACTION)) done[si] = true;
    }
  }
  const coverage = covered.map((row) => (row.length ? row.filter(Boolean).length / row.length : 0));
  // Both ends of every stroke must have been reached — 80% of the
  // checkpoints alone can be satisfied with the last third of a stroke
  // never drawn (see LetterTracer's END_TOLERANCE_PX note).
  const strokeDone = coverage.map((c, si) => c >= STROKE_DONE_FRACTION && covered[si][0] === true && covered[si][covered[si].length - 1] === true);
  let near = 0;
  const allCps = checkpoints.flat();
  for (const d of drawnPts) {
    if (allCps.some((c) => (c.x - d.x) * (c.x - d.x) + (c.y - d.y) * (c.y - d.y) < tol2)) near++;
  }
  const adherence = drawnPts.length ? near / drawnPts.length : 0;
  const b = drawnPts.length ? bounds(drawnPts) : null;
  const bigEnough = !!b && b.maxY - b.minY >= templateHeight * MIN_DRAWN_HEIGHT_FRACTION;
  const complete = strokeDone.length > 0 && strokeDone.every(Boolean) && adherence >= ADHERENCE_MIN && bigEnough;
  return { coverage, strokeDone, adherence, complete, checkpoints, covered };
}
