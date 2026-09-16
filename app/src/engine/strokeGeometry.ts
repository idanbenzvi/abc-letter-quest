import { getLetterForm } from '../data/letterStrokes';

// Turns data/letterStrokes.ts's teaching-order SVG paths into polylines
// with arc-length lookup — shared by the 3D sky tracer/guide (via
// three/strokeFit.ts, which fits them onto a letter cloud) and the 2D
// lined writing page (components/WritingPractice.tsx, which uses them
// raw). Deliberately free of any three.js import: this module is in the
// first-load chunk.

export interface Pt {
  x: number;
  y: number;
}

export interface GuideStroke {
  /** Dense polyline in cloud-local sample-pixel space, ~2px apart. */
  points: Pt[];
  /** Cumulative arc length at each point (same units). */
  cum: number[];
  length: number;
}

const NS = 'http://www.w3.org/2000/svg';
let measurePath: SVGPathElement | null = null;

/** A detached-but-attached SVG path we can ask for real arc-length geometry (getPointAtLength handles the A/Q commands for us). */
function getMeasurePath(): SVGPathElement | null {
  if (typeof document === 'undefined') return null;
  if (measurePath) return measurePath;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.left = '-10000px';
  svg.style.top = '0';
  svg.style.pointerEvents = 'none';
  measurePath = document.createElementNS(NS, 'path');
  svg.appendChild(measurePath);
  document.body.appendChild(svg);
  return measurePath;
}

export function samplePath(d: string, spacing: number): Pt[] {
  const el = getMeasurePath();
  if (!el) return [];
  el.setAttribute('d', d);
  const total = el.getTotalLength();
  const count = Math.max(2, Math.ceil(total / spacing) + 1);
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const p = el.getPointAtLength((total * i) / (count - 1));
    out.push({ x: p.x, y: p.y });
  }
  return out;
}


export function toGuideStroke(points: Pt[]): GuideStroke {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, cum, length: cum[cum.length - 1] };
}

const rawCache = new Map<string, GuideStroke[]>();

/**
 * Teaching-order strokes for `letter` in the stroke data's OWN viewBox
 * space (0..100 × 0..120, y-down; cap top 15, x-height 52, baseline
 * 100, descender 116) — no cloud fitting. For the 2D lined writing page
 * (components/WritingPractice.tsx), which lays the letter out against
 * real handwriting lines rather than a cloud glyph.
 */
export function getStrokePolylines(letter: string): GuideStroke[] {
  const hit = rawCache.get(letter);
  if (hit) return hit;
  const isUpper = letter === letter.toUpperCase() && letter !== letter.toLowerCase();
  let raw: string[];
  try {
    raw = getLetterForm(letter, isUpper).strokes;
  } catch {
    rawCache.set(letter, []);
    return [];
  }
  const strokes = raw.map((d) => toGuideStroke(samplePath(d, 1.5)));
  rawCache.set(letter, strokes);
  return strokes;
}

/** Point (and unit tangent) at arc length `t` along a stroke, clamped to its ends. */
export function pointAlong(stroke: GuideStroke, t: number): { x: number; y: number; tx: number; ty: number } {
  const { points, cum, length } = stroke;
  if (points.length < 2) return { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, tx: 1, ty: 0 };
  const target = Math.max(0, Math.min(length, t));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const seg = cum[hi] - cum[lo] || 1;
  const f = (target - cum[lo]) / seg;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: a.x + dx * f, y: a.y + dy * f, tx: dx / len, ty: dy / len };
}

/**
 * Evenly spaced checkpoints along a stroke, always including both ends
 * — the units the tracer scores against (LetterTracer.tsx) and the
 * guide lights up as they're covered (StrokeGuide.tsx). A stroke too
 * short for two checkpoints (the dot on an i/j) gets its midpoint.
 */
export function checkpointsAlong(stroke: GuideStroke, spacing: number): Pt[] {
  if (stroke.length < spacing * 0.75) {
    const m = pointAlong(stroke, stroke.length / 2);
    return [{ x: m.x, y: m.y }];
  }
  const count = Math.max(2, Math.round(stroke.length / spacing) + 1);
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const p = pointAlong(stroke, (stroke.length * i) / (count - 1));
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** Live tracing progress shared between LetterTracer (writes) and StrokeGuide (reads every frame). */
export interface TraceProgress {
  /** covered[strokeIndex][checkpointIndex] */
  covered: boolean[][];
  /** done[strokeIndex] — enough of that stroke's checkpoints are covered. */
  done: boolean[];
  /** Bumped on every change so per-frame readers can cheaply skip work. */
  version: number;
}

/**
 * Which checkpoint-set (stroke) `point` is closest to, considering only
 * strokes for which `eligible(si)` is true. Used to gate coverage
 * scoring (LetterTracer.tsx, writingScore.ts) so a single drawn point
 * can only ever credit the ONE stroke it's actually nearest to — not
 * every stroke within the (deliberately generous) tolerance radius.
 *
 * Needed because several lowercase letterforms place one stroke
 * directly against another: 'd's bowl spans x 30-70 and its stem sits
 * at x=70, right on the bowl's own edge (b/p/q are the same, gaps of
 * 0-4px). Scored per-checkpoint without this gate, tracing only the
 * stem also lands within tolerance of most of the bowl's checkpoints
 * (their nearest point on the stem's own line is well under the
 * tolerance for most of the bowl's circumference), so the whole letter
 * completed after drawing a single line — never intended, caught by
 * playtesting a real 'd'. Nearest-stroke gating fixes it directly: a
 * point ON the stem has ~0 distance to the stem's own checkpoints and a
 * real (if small) distance to the bowl's, so it always credits the
 * stem, never the bowl, regardless of tolerance width.
 */
export function nearestStrokeIndex(point: Pt, checkpoints: Pt[][], eligible: (strokeIndex: number) => boolean): number {
  let best = -1;
  let bestDist = Infinity;
  for (let si = 0; si < checkpoints.length; si++) {
    if (!eligible(si)) continue;
    const cps = checkpoints[si];
    for (let ci = 0; ci < cps.length; ci++) {
      const dx = cps[ci].x - point.x;
      const dy = cps[ci].y - point.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = si;
      }
    }
  }
  return best;
}
