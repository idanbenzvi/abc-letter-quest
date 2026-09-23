import { sampleLetterPoints, type CloudPoint } from '../three/cloudLetter';
import { classifyHandwriting, isHandwritingModelAvailable } from './handwritingModel';

// "Watch after the child finishes writing it" — a single still frame,
// not motion capture (per the user — stroke-order/motion analysis is a
// later phase). Scoring reuses exactly traceScoring.ts's own
// coverage+adherence philosophy (how much of the target got covered,
// how much of what was drawn stayed on target), just applied to a
// point-cloud sampled from photographed ink instead of pointer-drag
// strokes — the two are unrelated data shapes (pixels vs. an ordered
// path) so the scoring MATH is shared in spirit, not the code itself.

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_INK_POINTS = 12; // fewer than this and there's no real attempt in the frame, not just a bad match
const DARK_THRESHOLD = 115; // pencil-on-white-paper luminance cutoff; generous on purpose — a photo's white paper is rarely pure white

/**
 * Samples the dark ("ink") pixels inside `crop` of an already-drawn
 * video frame, normalized to the same y-up, origin-centered convention
 * cloudLetter.ts's sampleLetterPoints uses — scaled so the ink's own
 * bounding box height becomes `targetHeight`, and re-centered on ITS
 * OWN bounding box (not the crop rect's center), since neither the
 * letter's exact size nor its exact position inside the guide box can
 * be controlled precisely by a 6-year-old holding a camera.
 */
export function sampleInkPoints(ctx: CanvasRenderingContext2D, crop: CropRect, step = 3, targetHeight = 240): CloudPoint[] {
  const { data } = ctx.getImageData(crop.x, crop.y, crop.w, crop.h);
  const raw: CloudPoint[] = [];
  for (let y = 0; y < crop.h; y += step) {
    for (let x = 0; x < crop.w; x += step) {
      const i = (x + y * crop.w) * 4;
      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (luminance < DARK_THRESHOLD) raw.push({ x, y });
    }
  }
  if (raw.length < MIN_INK_POINTS) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of raw) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const height = Math.max(1, maxY - minY);
  const scale = targetHeight / height;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // y-up (negated) to match sampleLetterPoints' own convention — see its doc comment.
  return raw.map((p) => ({ x: (p.x - cx) * scale, y: -(p.y - cy) * scale }));
}

export interface HandwritingScore {
  coverage: number;
  adherence: number;
  score: number;
  /** Generous on purpose — this is a "did they make a real, recognizable attempt" check, not OCR. A near-miss should still pass rather than force a frustrating retry loop over camera angle/lighting, not just letter knowledge. */
  matched: boolean;
}

const MATCH_TOLERANCE = 26; // in the same normalized units as targetHeight=240 — roughly a stroke-width's worth of slack
const COVERAGE_MIN = 0.5;
const ADHERENCE_MIN = 0.4;

function dist(a: CloudPoint, b: CloudPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** `letter` should be whatever case the child was actually asked to write (encounter.displayChar) — matching every other path in this game. */
export function scoreHandwriting(letter: string, inkPoints: CloudPoint[]): HandwritingScore {
  if (inkPoints.length === 0) return { coverage: 0, adherence: 0, score: 0, matched: false };
  const targetPoints = sampleLetterPoints(letter, 240, 6);
  if (targetPoints.length === 0) return { coverage: 0, adherence: 0, score: 0, matched: false };

  const coverage = targetPoints.filter((t) => inkPoints.some((p) => dist(t, p) <= MATCH_TOLERANCE)).length / targetPoints.length;
  const adherence = inkPoints.filter((p) => targetPoints.some((t) => dist(p, t) <= MATCH_TOLERANCE)).length / inkPoints.length;
  const score = Math.round(((coverage + adherence) / 2) * 100);
  const matched = coverage >= COVERAGE_MIN && adherence >= ADHERENCE_MIN;
  return { coverage, adherence, score, matched };
}

export interface HandwritingCheckResult extends HandwritingScore {
  modelPrediction: { letter: string; confidence: number } | null;
}

const MODEL_CONFIDENCE_MIN = 0.6;

/**
 * Combines the guaranteed shape-match above (always runs, needs no
 * model) with an optional on-device model prediction when one's
 * available (engine/handwritingModel.ts) — either signal passing is
 * enough to count the photo as a match. That "OR", not "AND", is
 * deliberate: a model makes genuine handwriting recognized MORE often,
 * it can never make an already-passing photo fail, so this never
 * regresses the out-of-the-box "no model installed" behavior — it's
 * purely additive.
 */
export async function checkHandwriting(letter: string, ctx: CanvasRenderingContext2D, crop: CropRect): Promise<HandwritingCheckResult> {
  const inkPoints = sampleInkPoints(ctx, crop);
  const shapeScore = scoreHandwriting(letter, inkPoints);

  let modelPrediction: { letter: string; confidence: number } | null = null;
  if (inkPoints.length > 0 && (await isHandwritingModelAvailable())) {
    const imageData = ctx.getImageData(crop.x, crop.y, crop.w, crop.h);
    modelPrediction = await classifyHandwriting(imageData);
  }

  const modelAgrees = !!modelPrediction && modelPrediction.letter.toUpperCase() === letter.toUpperCase() && modelPrediction.confidence >= MODEL_CONFIDENCE_MIN;
  return { ...shapeScore, matched: shapeScore.matched || modelAgrees, modelPrediction };
}
