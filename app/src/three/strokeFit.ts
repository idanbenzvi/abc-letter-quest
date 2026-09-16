import { sampleLetterPoints, type CloudPoint } from './cloudLetter';
import { getLetterForm } from '../data/letterStrokes';
import { samplePath, toGuideStroke, type GuideStroke, type Pt } from '../engine/strokeGeometry';

// Lays the teaching-order strokes over the letter CLOUD — in the same
// "sample pixel" space cloudLetter.ts's puffs live in (y-up, centered),
// so StrokeGuide.tsx and LetterTracer.tsx can position sprites with the
// very same `scale` factor the cloud itself uses.
//
// The stroke data is a schematic, fairly narrow letterform (viewBox
// 0 0 100 120, baseline 100, cap top 15); the cloud is Nunito Black at
// 240px. Their proportions don't match, so instead of one global scale
// this fits each letter's stroke bounding box onto that letter's own
// sampled glyph bounding box (inset by half a stem, since the strokes
// are centerlines and the glyph outline sits half a stem outside them).
// Non-uniform, per letter — good enough that the guide sits on the
// fuzzy cloud's own skeleton rather than floating beside it.
//
// Lives on the three.js side (cloudLetter.ts imports three) so the
// shared engine/strokeGeometry.ts stays out of the 3D chunk.

function bbox(points: Pt[] | CloudPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
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

// Half a Nunito Black stem at the cloud's 240px sampling size — how far
// inside the glyph's outline its centerline skeleton sits.
const INSET_X = 20;
const INSET_Y = 18;
// Below this stroke-space width the letter is a single vertical (I, l,
// i…) and an x-fit would divide by ~zero — fall back to centering.
const MIN_FIT_WIDTH = 8;

/** Teaching-order strokes for `letter` (upper or lower case as given), fitted onto that glyph's cloud. Cached per letter. */
const cache = new Map<string, GuideStroke[]>();

export function getGuideStrokes(letter: string): GuideStroke[] {
  const hit = cache.get(letter);
  if (hit) return hit;

  const isUpper = letter === letter.toUpperCase() && letter !== letter.toLowerCase();
  let raw: string[];
  try {
    raw = getLetterForm(letter, isUpper).strokes;
  } catch {
    cache.set(letter, []);
    return [];
  }
  const sampled = raw.map((d) => samplePath(d, 1.5));
  const glyph = sampleLetterPoints(letter);
  if (sampled.length === 0 || glyph.length === 0) {
    cache.set(letter, []);
    return [];
  }

  const s = bbox(sampled.flat());
  const g = bbox(glyph);
  const gx0 = g.minX + INSET_X;
  const gx1 = g.maxX - INSET_X;
  const gy0 = g.minY + INSET_Y;
  const gy1 = g.maxY - INSET_Y;
  const sW = s.maxX - s.minX;
  const sH = Math.max(1, s.maxY - s.minY);
  const scaleY = (gy1 - gy0) / sH;
  const narrow = sW < MIN_FIT_WIDTH;
  const scaleX = narrow ? scaleY : (gx1 - gx0) / sW;
  const sCx = (s.minX + s.maxX) / 2;
  const gCx = (gx0 + gx1) / 2;

  const mapPt = (p: Pt): Pt => ({
    x: narrow ? gCx + (p.x - sCx) * scaleX : gx0 + (p.x - s.minX) * scaleX,
    // stroke space is y-down (SVG); cloud space is y-up
    y: gy1 - (p.y - s.minY) * scaleY,
  });

  const strokes: GuideStroke[] = sampled.map((pts) => toGuideStroke(pts.map(mapPt)));
  cache.set(letter, strokes);
  return strokes;
}

