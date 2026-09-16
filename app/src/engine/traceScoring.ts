// Scoring for the interactive trace challenge — see
// docs/04-screens-spec.md#trace-challenge-your-turn and
// docs/07-architecture.md#tracing-engine. Pure geometry, no DOM/React,
// so it's unit-testable in isolation from the pointer-capture code.

export interface Point {
  x: number;
  y: number;
}

/** Evenly-spaced points along an SVG path, using its real DOM geometry. */
export function samplePath(pathEl: SVGPathElement, count: number): Point[] {
  const total = pathEl.getTotalLength();
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const p = pathEl.getPointAtLength((total * i) / Math.max(1, count - 1));
    points.push({ x: p.x, y: p.y });
  }
  return points;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function withinTolerance(p: Point, targets: Point[], tolerance: number): boolean {
  return targets.some((t) => dist(p, t) <= tolerance);
}

export interface TraceScore {
  coverage: number; // 0-1: how much of the letter the child actually traced over
  adherence: number; // 0-1: how much of what they drew stayed on the letter
  score: number; // 0-100, the two combined
}

/**
 * Both halves matter for a reason: coverage alone lets a child scribble
 * back and forth over one spot and "cover" nothing else; adherence
 * alone doesn't check the whole letter got traced. A child who traces
 * accurately but only half the letter, or covers the whole letter but
 * wanders way off the path, should score lower than one who does both.
 */
export function scoreTrace(targetPoints: Point[], userPoints: Point[], tolerance: number): TraceScore {
  if (userPoints.length === 0 || targetPoints.length === 0) {
    return { coverage: 0, adherence: 0, score: 0 };
  }
  const coverage = targetPoints.filter((t) => withinTolerance(t, userPoints, tolerance)).length / targetPoints.length;
  const adherence = userPoints.filter((u) => withinTolerance(u, targetPoints, tolerance)).length / userPoints.length;
  const score = Math.round(((coverage + adherence) / 2) * 100);
  return { coverage, adherence, score };
}
